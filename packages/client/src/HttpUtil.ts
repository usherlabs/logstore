import { StreamMessage } from '@streamr/protocol';
import { Logger, toEthereumAddress } from '@streamr/utils';
import { ethers } from 'ethers';
import { Base64 } from 'js-base64';
import fetch, { Response } from 'node-fetch';
import split2 from 'split2';
import { Readable } from 'stream';
import { inject, Lifecycle, scoped } from 'tsyringe';

import { Authentication, AuthenticationInjectionToken } from './Authentication';
import { Consensus } from './Consensus';
import { LoggerFactory } from './utils/LoggerFactory';
import { getVersionString } from './utils/utils';
import { WebStreamToNodeStream } from './utils/WebStreamToNodeStream';

export enum ErrorCode {
	NOT_FOUND = 'NOT_FOUND',
	VALIDATION_ERROR = 'VALIDATION_ERROR',
	UNKNOWN = 'UNKNOWN',
}

export const DEFAULT_HEADERS = {
	'LogStore-Client': `logstore-client-javascript/${getVersionString()}`,
};

export class HttpError extends Error {
	public response?: Response;
	public body?: any;
	public code: ErrorCode;
	public errorCode: ErrorCode;

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	constructor(
		message: string,
		response?: Response,
		body?: any,
		errorCode?: ErrorCode
	) {
		const typePrefix = errorCode ? errorCode + ': ' : '';
		// add leading space if there is a body set
		super(typePrefix + message);
		this.response = response;
		this.body = body;
		this.code = errorCode || ErrorCode.UNKNOWN;
		this.errorCode = this.code;
	}
}

export class ValidationError extends HttpError {
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	constructor(message: string, response?: Response, body?: any) {
		super(message, response, body, ErrorCode.VALIDATION_ERROR);
	}
}

export class NotFoundError extends HttpError {
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	constructor(message: string, response?: Response, body?: any) {
		super(message, response, body, ErrorCode.NOT_FOUND);
	}
}

const ERROR_TYPES = new Map<ErrorCode, typeof HttpError>();
ERROR_TYPES.set(ErrorCode.VALIDATION_ERROR, ValidationError);
ERROR_TYPES.set(ErrorCode.NOT_FOUND, NotFoundError);
ERROR_TYPES.set(ErrorCode.UNKNOWN, HttpError);

const parseErrorCode = (body: string) => {
	let json;
	try {
		json = JSON.parse(body);
	} catch (err) {
		return ErrorCode.UNKNOWN;
	}

	const { code } = json;
	return code in ErrorCode ? code : ErrorCode.UNKNOWN;
};

@scoped(Lifecycle.ContainerScoped)
export class HttpUtil {
	private authentication: Authentication;
	private readonly logger: Logger;

	constructor(
		@inject(AuthenticationInjectionToken)
		authentication: Authentication,
		@inject(LoggerFactory)
		loggerFactory: LoggerFactory
	) {
		this.authentication = authentication;
		this.logger = loggerFactory.createLogger(module);
	}

	async *fetchHttpStream(
		url: string,
		abortController = new AbortController()
	): AsyncIterable<StreamMessage> {
		const authUser = await this.authentication.getAddress();
		const authPassword = await this.authentication.createMessageSignature(
			authUser
		);

		const response = await fetchResponse(url, this.logger, {
			signal: abortController.signal,
			headers: {
				Authorization: `Basic ${Base64.encode(`${authUser}:${authPassword}`)}`,
			},
		});
		if (!response.body) {
			throw new Error('No Response Body');
		}

		try {
			const consensus = JSON.parse(
				response.headers.get('consensus') ?? ''
			) as Consensus[];

			const hash = consensus[0].hash;

			for (const item of consensus) {
				const signer = toEthereumAddress(
					ethers.utils.verifyMessage(item.hash, item.signature)
				);

				const itemSigner = toEthereumAddress(item.signer);
				if (item.hash != hash || itemSigner != signer) {
					throw new Error('No consensus');
				}
			}
		} catch {
			throw new Error('No consensus');
		}

		let stream: Readable | undefined;
		try {
			// in the browser, response.body will be a web stream. Convert this into a node stream.
			const source: Readable = WebStreamToNodeStream(
				response.body as unknown as ReadableStream | Readable
			);

			stream = source.pipe(
				split2((message: string) => {
					return StreamMessage.deserialize(message);
				})
			);

			stream.once('close', () => {
				abortController.abort();
			});

			yield* stream;
		} catch (err) {
			abortController.abort();
			throw err;
		} finally {
			stream?.destroy();
		}
	}

	// eslint-disable-next-line class-methods-use-this
	createQueryString(query: Record<string, any>): string {
		const withoutEmpty = Object.fromEntries(
			Object.entries(query).filter(([_k, v]) => v != null)
		);
		return new URLSearchParams(withoutEmpty).toString();
	}
}

async function fetchResponse(
	url: string,
	logger: Logger,
	opts?: any, // eslint-disable-line @typescript-eslint/explicit-module-boundary-types
	fetchFn: typeof fetch = fetch
): Promise<Response> {
	const timeStart = Date.now();

	const options = {
		...opts,
		headers: {
			...DEFAULT_HEADERS,
			...(opts && opts.headers),
		},
	};
	// add default 'Content-Type: application/json' header for all POST and PUT requests
	if (
		!options.headers['Content-Type'] &&
		(options.method === 'POST' || options.method === 'PUT')
	) {
		options.headers['Content-Type'] = 'application/json';
	}

	logger.debug('fetching %s with options %j', url, opts);

	const response: Response = await fetchFn(url, opts);
	const timeEnd = Date.now();
	logger.debug(
		'%s responded with %d %s %s in %d ms',
		url,
		response.status,
		response.statusText,
		response.size,
		timeEnd - timeStart
	);

	if (response.ok) {
		return response;
	}

	const body = await response.text();
	const errorCode = parseErrorCode(body);
	const ErrorClass = ERROR_TYPES.get(errorCode)!;
	throw new ErrorClass(
		`Request to ${url} returned with error code ${response.status}.`,
		response,
		body,
		errorCode
	);
}
