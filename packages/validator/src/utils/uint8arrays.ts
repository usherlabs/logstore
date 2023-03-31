/**
 * ? Reference: https://github.com/achingbrain/uint8arrays
 */
import { bases } from 'multiformats/basics';

export type SupportedEncodings =
	| 'utf8'
	| 'utf-8'
	| 'hex'
	| 'latin1'
	| 'ascii'
	| 'binary'
	| keyof typeof bases;

/**
 * To guarantee Uint8Array semantics, convert nodejs Buffers
 * into vanilla Uint8Arrays
 */
export function asUint8Array(buf: Uint8Array): Uint8Array {
	if (globalThis.Buffer != null) {
		return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
	}

	return buf;
}

/**
 * Create a `Uint8Array` from the passed string
 *
 * Supports `utf8`, `utf-8`, `hex`, and any encoding supported by the multiformats module.
 *
 * Also `ascii` which is similar to node's 'binary' encoding.
 */
export function fromString(
	string: string,
	encoding: SupportedEncodings = 'utf8'
): Uint8Array {
	const base = bases[encoding];

	if (base == null) {
		throw new Error(`Unsupported encoding "${encoding}"`);
	}

	if (
		(encoding === 'utf8' || encoding === 'utf-8') &&
		globalThis.Buffer != null &&
		globalThis.Buffer.from != null
	) {
		return asUint8Array(globalThis.Buffer.from(string, 'utf-8'));
	}

	// add multibase prefix
	return base.decoder.decode(`${base.prefix}${string}`); // eslint-disable-line @typescript-eslint/restrict-template-expressions
}

/**
 * Turns a `Uint8Array` into a string.
 *
 * Supports `utf8`, `utf-8` and any encoding supported by the multibase module.
 *
 * Also `ascii` which is similar to node's 'binary' encoding.
 */
export function toString(
	array: Uint8Array,
	encoding: SupportedEncodings = 'utf8'
): string {
	const base = bases[encoding];

	if (base == null) {
		throw new Error(`Unsupported encoding "${encoding}"`);
	}

	if (
		(encoding === 'utf8' || encoding === 'utf-8') &&
		globalThis.Buffer != null &&
		globalThis.Buffer.from != null
	) {
		return globalThis.Buffer.from(
			array.buffer,
			array.byteOffset,
			array.byteLength
		).toString('utf8');
	}

	// strip multibase prefix
	return base.encoder.encode(array).substring(1);
}
