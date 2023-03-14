import secp256k1 from 'secp256k1';
import { Keccak } from 'sha3';

const SIGN_MAGIC = '\u0019Ethereum Signed Message:\n';
const keccak = new Keccak(256);

function hash(messageBuffer: Buffer) {
	const prefixString = SIGN_MAGIC + messageBuffer.length;
	const merged = Buffer.concat([
		Buffer.from(prefixString, 'utf-8'),
		messageBuffer,
	]);
	keccak.reset();
	keccak.update(merged);
	return keccak.digest('binary');
}

function normalize(privateKeyOrAddress: string): string {
	return privateKeyOrAddress.startsWith('0x')
		? privateKeyOrAddress.substring(2)
		: privateKeyOrAddress;
}
export function sign(payload: string, privateKey: string): string {
	const payloadBuffer = Buffer.from(payload, 'utf-8');
	const privateKeyBuffer = Buffer.from(normalize(privateKey), 'hex');

	const msgHash = hash(payloadBuffer);
	const sigObj = secp256k1.ecdsaSign(msgHash, privateKeyBuffer);
	const result = Buffer.alloc(
		sigObj.signature.length + 1,
		Buffer.from(sigObj.signature)
	);
	result.writeInt8(27 + sigObj.recid, result.length - 1);
	return '0x' + result.toString('hex');
}
