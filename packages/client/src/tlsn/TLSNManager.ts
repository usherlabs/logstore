import initWASM, {
	initThreadPool,
	verify,
} from 'tlsn-verify-rs/tlsn_verify_rs';
import { Lifecycle, scoped } from 'tsyringe';
import type { BufferSource } from 'node:stream/web';

const getNumThreads = () => {
	if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
		return navigator.hardwareConcurrency;
	} else {
		// Default to 4 threads as usual minimum, even on phones running it
		return 4;
	}
};

const getWasmSource = async (): Promise<BufferSource | undefined> => {
	const isBrowser = typeof window !== 'undefined';

	if (isBrowser) {
		// we avoid code splitting here, otherwise as we're a library, depending on our user it may fail
		// but if you think you can fix this, to make it work with code splitting
		// feel free to do so.
		// make sure to test on the browser and nodejs

		// webpack will replace this import with a binary string from the wasm file
		const { default: wasm } = await import(
			/* webpackMode: 'eager' */
			'tlsn-verify-rs/tlsn_verify_rs_bg.wasm'
		);
		if (typeof wasm !== 'string') {
			throw new Error(
				'Wrong WASM file loaded. Please report an issue. It should be using the webpack compiled build on web.'
			);
		}
		return Buffer.from(wasm, 'binary'); // Create a Buffer from binary string
	} else {
		const fs = await import(/* webpackIgnore: true */ 'fs');
		const wasmPath = require.resolve('tlsn-verify-rs/tlsn_verify_rs_bg.wasm');
		return fs.promises.readFile(wasmPath);
	}
};

/**
 * TlsnManager is responsible for verifying TLSN proofs.
 */
@scoped(Lifecycle.ContainerScoped)
export class TLSNManager {
	private startPromise: Promise<void> | undefined;

	constructor() {}

	private async start(): Promise<void> {
		const wasmSource = await getWasmSource();
		await initWASM(wasmSource);
		initThreadPool(getNumThreads());
	}

	public async verifyTlsProof(
		proof: string,
		notaryPublicKey: string
	): Promise<string> {
		// we only start the wasm once, and we wait for it to be ready
		this.startPromise ||= this.start();
		await this.startPromise;

		return verify(proof, notaryPublicKey);
	}
}
