import {
	LengthPrefixedFrameDecoder,
	Logger,
	composeAbortSignals,
	randomString
} from '@streamr/utils';
import fetch, { Response } from 'node-fetch';
import { Readable } from 'stream';

import { Base64 } from 'js-base64';
import { compact } from 'lodash';
import { Authentication } from '../streamr/Authentication';
import { WebStreamToNodeStream } from '../streamr/utils/WebStreamToNodeStream';
import { SEPARATOR } from './uuid';

const logger = new Logger(module)

/**
 * Generates counter-based ids.
 * Basically lodash.uniqueid but per-prefix.
 * Not universally unique.
 * Generally useful for tracking instances.
 *
 * Careful not to use too many prefixes since it needs to hold all prefixes in memory
 * e.g. don't pass new uuid as a prefix
 *
 * counterId('test') => test.0
 * counterId('test') => test.1
 */

type CounterIdType = ((prefix: string, separator?: string) => string) & {
	clear: (...args: [string] | []) => void;
};
export const CounterId = (
	rootPrefix?: string,
	{ maxPrefixes = 256 }: { maxPrefixes?: number } = {}
): CounterIdType => {
	let counts: Record<string, number> = {}; // possible we could switch this to WeakMap and pass functions or classes.
	let didWarn = false;
	const counterIdFn = (prefix = 'ID', separator = SEPARATOR) => {
		// pedantic: wrap around if count grows too large
		counts[prefix] = (counts[prefix] + 1 || 0) % Number.MAX_SAFE_INTEGER;

		// warn once if too many prefixes
		if (!didWarn) {
			const numTracked = Object.keys(counts).length;
			if (numTracked > maxPrefixes) {
				didWarn = true;
				console.warn(
					`counterId should not be used for a large number of unique prefixes: ${numTracked} > ${maxPrefixes}`
				);
			}
		}

		// connect prefix with separator
		return [rootPrefix, prefix, counts[prefix]]
			.filter((v) => v != null) // remove {root}Prefix if not set
			.join(separator);
	};

	/**
	 * Clears counts for prefix or all if no prefix supplied.
	 *
	 * @param {string?} prefix
	 */
	counterIdFn.clear = (...args: [string] | []) => {
		// check length to differentiate between clear(undefined) & clear()
		if (args.length) {
			const [prefix] = args;
			delete counts[prefix];
		} else {
			// clear all
			counts = {};
		}
	};
	return counterIdFn;
};

export const counterId = CounterId();

export function generateClientId(): string {
	return counterId(process.pid ? `${process.pid}` : randomString(4), '/');
}

export const fetchAuthParams = async (authentication: Authentication) => {
	const user = await authentication.getAddress();
	const signature = await authentication.createMessageSignature(Buffer.from(user));
	const signatureStr = Buffer.from(signature).toString('base64');
	const token = Base64.encode(`${user}:${signatureStr}`);

	return {
		user,
		token,
	};
}

export class FetchHttpStreamResponseError extends Error {

	response: Response

	constructor(response: Response) {
		super(`Fetch error, url=${response.url}`)
		this.response = response
	}
}

export const fetchLengthPrefixedFrameHttpBinaryStream = async function* (
	url: string,
	headers: Record<string, string>,
	abortSignal?: AbortSignal
): AsyncGenerator<Uint8Array, void, undefined> {
	logger.debug('Send HTTP request', { url })
	const abortController = new AbortController()
	const fetchAbortSignal = composeAbortSignals(...compact([abortController.signal, abortSignal]))
	const response: Response = await fetch(url, {
		headers,
		signal: fetchAbortSignal
	})
	logger.debug('Received HTTP response', {
		url,
		status: response.status,
	})
	if (!response.ok) {
		throw new FetchHttpStreamResponseError(response)
	}
	if (!response.body) {
		throw new Error('No Response Body')
	}

	let stream: Readable | undefined
	try {
		// in the browser, response.body will be a web stream. Convert this into a node stream.
		const source: Readable = WebStreamToNodeStream(response.body as unknown as (ReadableStream | Readable))
		stream = source.pipe(new LengthPrefixedFrameDecoder())
		source.on('error', (err: Error) => stream!.destroy(err))
		stream.once('close', () => {
			abortController.abort()
		})
		yield* stream
	} catch (err) {
		abortController.abort()
		throw err
	} finally {
		stream?.destroy()
		fetchAbortSignal.destroy()
	}
}

export const createQueryString = (query: Record<string, any>): string => {
	const withoutEmpty = Object.fromEntries(
		Object.entries(query).filter(([_k, v]) => v != null)
	);
	return new URLSearchParams(withoutEmpty).toString();
}
