use elliptic_curve::pkcs8::DecodePublicKey;
use futures::AsyncWriteExt;
use js_sys::{Array, JSON};
use tokio_util::compat::FuturesAsyncReadCompatExt;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;
pub use wasm_bindgen_rayon::init_thread_pool;
use web_sys::{Headers, Request as WebsysRequest, RequestInit, RequestMode, Response};

mod request_opt;

// A macro to provide `println!(..)`-style syntax for `console.log` logging.
macro_rules! log {
    ( $( $t:tt )* ) => {
        web_sys::console::log_1(&format!( $( $t )* ).into());
    }
}

#[wasm_bindgen]
extern "C" {
	#[wasm_bindgen(js_namespace = self)]
	fn fetch(request: &web_sys::Request) -> js_sys::Promise;
}

async fn fetch_as_json_string(url: &str, opts: &RequestInit) -> Result<String, JsValue> {
	let request = WebsysRequest::new_with_str_and_init(url, opts)?;
	let promise = fetch(&request);
	let future = JsFuture::from(promise);
	let resp_value = future.await?;
	let resp: Response = resp_value.dyn_into()?;
	let json = JsFuture::from(resp.json()?).await?;
	let stringified = JSON::stringify(&json)?;
	stringified
		.as_string()
		.ok_or_else(|| JsValue::from_str("Could not stringify JSON"))
}

#[wasm_bindgen]
pub async fn verify(proof: &str, notary_pubkey_str: &str) -> Result<String, JsValue> {
	log!("!@# proof {}", proof);
	let proof: TlsProof = serde_json::from_str(proof)
		.map_err(|e| JsValue::from_str(&format!("Could not deserialize proof: {:?}", e)))?;

	let TlsProof {
		// The session proof establishes the identity of the server and the commitments
		// to the TLS transcript.
		session,
		// The substrings proof proves select portions of the transcript, while redacting
		// anything the Prover chose not to disclose.
		substrings,
	} = proof;

	log!(
        "!@# notary_pubkey {}, {}",
        notary_pubkey_str,
        notary_pubkey_str.len()
    );
	session
		.verify_with_default_cert_verifier(get_notary_pubkey(notary_pubkey_str)?)
		.map_err(|e| JsValue::from_str(&format!("Session verification failed: {:?}", e)))?;

	let SessionProof {
		// The session header that was signed by the Notary is a succinct commitment to the TLS transcript.
		header,
		// This is the server name, checked against the certificate chain shared in the TLS handshake.
		server_name,
		..
	} = session;

	// The time at which the session was recorded
	let time = chrono::DateTime::UNIX_EPOCH + Duration::from_secs(header.time());

	// Verify the substrings proof against the session header.
	//
	// This returns the redacted transcripts
	let (mut sent, mut recv) = substrings
		.verify(&header)
		.map_err(|e| JsValue::from_str(&format!("Could not verify substrings: {:?}", e)))?;

	// Replace the bytes which the Prover chose not to disclose with 'X'
	sent.set_redacted(b'X');
	recv.set_redacted(b'X');

	log!("-------------------------------------------------------------------");
	log!(
        "Successfully verified that the bytes below came from a session with {:?} at {}.",
        server_name,
        time
    );
	log!("Note that the bytes which the Prover chose not to disclose are shown as X.");
	log!("Bytes sent:");
	log!(
        "{}",
        String::from_utf8(sent.data().to_vec()).map_err(|e| JsValue::from_str(&format!(
            "Could not convert sent data to string: {:?}",
            e
        )))?
    );
	log!("Bytes received:");
	log!(
        "{}",
        String::from_utf8(recv.data().to_vec()).map_err(|e| JsValue::from_str(&format!(
            "Could not convert recv data to string: {:?}",
            e
        )))?
    );
	log!("-------------------------------------------------------------------");

	let result = VerifyResult {
		server_name: String::from(server_name.as_str()),
		time: header.time(),
		sent: String::from_utf8(sent.data().to_vec()).map_err(|e| {
			JsValue::from_str(&format!("Could not convert sent data to string: {:?}", e))
		})?,
		recv: String::from_utf8(recv.data().to_vec()).map_err(|e| {
			JsValue::from_str(&format!("Could not convert recv data to string: {:?}", e))
		})?,
	};
	let res = serde_json::to_string_pretty(&result)
		.map_err(|e| JsValue::from_str(&format!("Could not serialize result: {:?}", e)))?;

	Ok(res)
}

#[allow(unused)]
fn print_type_of<T: ?Sized>(_: &T) {
	log!("{}", std::any::type_name::<T>());
}

/// Returns a Notary pubkey trusted by this Verifier
fn get_notary_pubkey(pubkey: &str) -> Result<p256::PublicKey, JsValue> {
	// from https://github.com/tlsnotary/notary-server/tree/main/src/fixture/notary/notary.key
	// converted with `openssl ec -in notary.key -pubout -outform PEM`
	p256::PublicKey::from_public_key_pem(pubkey)
		.map_err(|e| JsValue::from_str(&format!("Could not get notary pubkey: {:?}", e)))
}
