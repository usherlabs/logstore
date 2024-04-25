import { composeAbortSignals, Logger } from '@streamr/utils';
import { Base64 } from 'js-base64';
import compact from 'lodash/compact';
import fetch, { Response } from 'node-fetch';
import { AbortSignal as FetchAbortSignal } from 'node-fetch/externals';
import split2 from 'split2';
import { Readable } from 'stream';
import { inject, Lifecycle, scoped } from 'tsyringe';

import {
	Authentication,
	AuthenticationInjectionToken,
} from './streamr/Authentication';
import {
	LoggerFactory,
	LoggerFactoryInjectionToken,
} from './streamr/LoggerFactory';
import { WebStreamToNodeStream } from './streamr/utils/WebStreamToNodeStream';
import { getVersionString } from './utils/utils';

export enum ErrorCode {
	NOT_FOUND = 'NOT_FOUND',
	VALIDATION_ERROR = 'VALIDATION_ERROR',
	UNKNOWN = 'UNKNOWN',
}

export class FetchHttpStreamResponseError extends Error {
	constructor(
		public response: Omit<Response, 'text' | 'body'>, // it was already consumed
		public body: any
	) {
		super(`Fetch error, url=${response.url}`);
		this.response = response;
	}
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
		@inject(LoggerFactoryInjectionToken)
		loggerFactory: LoggerFactory
	) {
		this.authentication = authentication;
		this.logger = loggerFactory.createLogger(module);
	}

	async *fetchHttpStream(
		url: string,
		abortSignal?: AbortSignal
	): AsyncGenerator<string, void, undefined> {
		this.logger.debug('Send HTTP request', { url });
		const abortController = new AbortController();
		const fetchAbortSignal = composeAbortSignals(
			...compact([abortController.signal, abortSignal])
		);

		const { token: authToken } = await this.fetchAuthParams();

		const response = await fetchResponse(url, this.logger, {
			// cast is needed until this is fixed: https://github.com/node-fetch/node-fetch/issues/1652
			signal: fetchAbortSignal as FetchAbortSignal,
			headers: {
				Authorization: `Basic ${authToken}`,
				// TODO: Implement proper support of SSE
				// Accept: 'text/event-stream',
			},
		}).catch((err) => {
			// `fetchResponse` throws this error, and we make that explicit here
			if (err instanceof HttpError) {
				return err;
			}
			throw err;
		});

		if (response instanceof HttpError) {
			if (!response.response) {
				throw response;
			}
			throw new FetchHttpStreamResponseError(response.response, response.body);
		}

		this.logger.debug('Received HTTP response', {
			url,
			status: response.status,
		});
		if (!response.ok) {
			throw new FetchHttpStreamResponseError(response, await response.text());
		}
		if (!response.body) {
			throw new Error('No Response Body');
		}

		let stream: Readable | undefined;
		try {
			// in the browser, response.body will be a web stream. Convert this into a node stream.
			const source: Readable = WebStreamToNodeStream(
				response.body as unknown as ReadableStream | Readable
			);

			stream = source.pipe(split2());

			// TODO: Implement proper support of SSE
			// stream = source.pipe(
			// 	new Transform({
			// 		objectMode: true,
			// 		transform(
			// 			chunk: any,
			// 			encoding: BufferEncoding,
			// 			done: TransformCallback
			// 		) {
			// 			const message = StreamMessage.deserialize(JSON.parse(chunk));
			// 			this.push(message);
			// 			done();
			// 		},
			// 	})
			// );

			source.on('error', (err: Error) => stream!.destroy(err));
			stream.once('close', () => {
				abortController.abort();
			});

			yield* stream;
		} catch (err) {
			abortController.abort();
			throw err;
		} finally {
			stream?.destroy();
			fetchAbortSignal.destroy();
		}
	}

	// eslint-disable-next-line class-methods-use-this
	createQueryString(query: Record<string, any>): string {
		const withoutEmpty = Object.fromEntries(
			Object.entries(query).filter(([_k, v]) => v != null)
		);
		return new URLSearchParams(withoutEmpty).toString();
	}

	async fetchAuthParams() {
		const user = await this.authentication.getAddress();
		const password = await this.authentication.createMessageSignature(user);
		const token = Base64.encode(`${user}:${password}`);

		return {
			user,
			password,
			token,
		};
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

	logger.debug('fetching', { url, opts });

	const response: Response = await fetchFn(url, opts);
	const timeEnd = Date.now();
	logger.debug('responded with', {
		url,
		status: response.status,
		statusText: response.statusText,
		size: response.size,
		ms: timeEnd - timeStart,
	});

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
