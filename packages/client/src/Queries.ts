import {
	StreamMessage,
	StreamPartID,
	StreamPartIDUtils,
} from '@streamr/protocol';
import { Logger, randomString, toEthereumAddress } from '@streamr/utils';
import { defer, EMPTY, filter, map, partition, shareReplay } from 'rxjs';
import { inject, Lifecycle, scoped } from 'tsyringe';

import {
	LogStoreClientConfigInjectionToken,
	type StrictLogStoreClientConfig,
} from './Config';
import {
	FetchHttpStreamResponseError,
	HttpUtil,
	RequestMetadata,
} from './HttpUtil';
import { LogStoreMessageStream } from './LogStoreMessageStream';
import { NodeManager } from './registry/NodeManager';
import {
	LoggerFactory,
	LoggerFactoryInjectionToken,
} from './streamr/LoggerFactory';
import { StreamrClientError } from './streamr/StreamrClientError';
import {
	MessagePipelineFactory,
	MessagePipelineFactoryInjectionToken,
} from './streamr/subscribe/MessagePipelineFactory';
import { transformError } from './streamr/utils/GeneratorUtils';
import { pull, PushBuffer } from './streamr/utils/PushBuffer';
import {
	validateWithNetworkResponses,
	type VerificationOptions,
} from './utils/networkValidation/validateNetworkResponses';
import { SystemMessageObservable } from './utils/SystemMessageObservable';
import { LogStoreClientSystemMessagesInjectionToken } from './utils/systemStreamUtils';

const MIN_SEQUENCE_NUMBER_VALUE = 0;

export enum QueryType {
	Last = 'last',
	From = 'from',
	Range = 'range',
}

export type BaseHttpQuery = {
	format?: 'raw' | 'protocol' | 'object';
};

export type HttpQueryLast = {
	count: number;
};

export type HttpQueryFrom = {
	fromTimestamp: number;
	fromSequenceNumber?: number;
	publisherId?: string;
};

export type HttpQueryRange = {
	fromTimestamp: number;
	toTimestamp: number;
	fromSequenceNumber?: number;
	toSequenceNumber?: number;
	publisherId?: string;
	msgChainId?: string;
};

export type HttpApiQueryDict = (
	| HttpQueryLast
	| HttpQueryFrom
	| HttpQueryRange
) &
	BaseHttpQuery;

export interface QueryRef {
	timestamp: number;
	sequenceNumber?: number;
}

/**
 * Query the latest "n" messages.
 */
export interface QueryLastOptions {
	last: number;
}

/**
 * Query messages starting from a given point in time.
 */
export interface QueryFromOptions {
	from: QueryRef;
	publisherId?: string;
}

/**
 * Query messages between two points in time.
 */
export interface QueryRangeOptions {
	from: QueryRef;
	to: QueryRef;
	msgChainId?: string;
	publisherId?: string;
}

/**
 * The supported Query types.
 */
export type QueryInput =
	| QueryLastOptions
	| QueryFromOptions
	| QueryRangeOptions;

function isQueryLast<T extends QueryLastOptions>(options: any): options is T {
	return (
		options &&
		typeof options === 'object' &&
		'last' in options &&
		options.last != null
	);
}

function isQueryFrom<T extends QueryFromOptions>(options: any): options is T {
	return (
		options &&
		typeof options === 'object' &&
		'from' in options &&
		!('to' in options) &&
		options.from != null
	);
}

function isQueryRange<T extends QueryRangeOptions>(options: any): options is T {
	return (
		options &&
		typeof options === 'object' &&
		'from' in options &&
		'to' in options &&
		options.to &&
		options.from != null
	);
}

export type QueryOptions = {
	abortSignal?: AbortSignal;
	verifyNetworkResponses?: VerificationOptions | boolean;
	raw?: boolean;
};

const getHttpErrorTransform = (): ((
	error: any
) => Promise<StreamrClientError>) => {
	return async (err: any) => {
		let message;
		if (err instanceof FetchHttpStreamResponseError) {
			const body = await err.response.text();
			let descriptionSnippet;
			try {
				const json = JSON.parse(body);
				descriptionSnippet = `: ${json.error}`;
			} catch {
				descriptionSnippet = '';
			}
			message = `Storage node fetch failed${descriptionSnippet}, httpStatus=${err.response.status}, url=${err.response.url}`;
		} else {
			message = err?.message ?? 'Unknown error';
		}
		return new StreamrClientError(message, 'STORAGE_NODE_ERROR');
	};
};

@scoped(Lifecycle.ContainerScoped)
export class Queries {
	private readonly nodeManager: NodeManager;
	private readonly httpUtil: HttpUtil;
	private readonly logger: Logger;
	private readonly messagePipelineFactory: MessagePipelineFactory;

	constructor(
		@inject(NodeManager)
		nodeManager: NodeManager,
		@inject(HttpUtil)
		httpUtil: HttpUtil,
		@inject(LogStoreClientConfigInjectionToken)
		private logStoreClientConfig: StrictLogStoreClientConfig,
		@inject(LoggerFactoryInjectionToken)
		loggerFactory: LoggerFactory,
		@inject(LogStoreClientSystemMessagesInjectionToken)
		private systemMessages$: SystemMessageObservable,
		@inject(MessagePipelineFactoryInjectionToken)
		messagePipelineFactory: MessagePipelineFactory
	) {
		this.nodeManager = nodeManager;
		this.httpUtil = httpUtil;
		this.logger = loggerFactory.createLogger(module);
		this.messagePipelineFactory = messagePipelineFactory;
	}

	async query(
		streamPartId: StreamPartID,
		input: QueryInput,
		options?: QueryOptions
	): Promise<LogStoreMessageStream> {
		if (isQueryLast(input)) {
			if (input.last <= 0) {
				const emptyStream = new PushBuffer<StreamMessage<unknown>>();
				return new LogStoreMessageStream(emptyStream, EMPTY);
			}
			return this.fetchStream(
				QueryType.Last,
				streamPartId,
				{
					count: input.last,
				},
				options
			);
		} else if (isQueryRange(input)) {
			return this.fetchStream(
				QueryType.Range,
				streamPartId,
				{
					fromTimestamp: new Date(input.from.timestamp).getTime(),
					fromSequenceNumber: input.from.sequenceNumber,
					toTimestamp: new Date(input.to.timestamp).getTime(),
					toSequenceNumber: input.to.sequenceNumber,
					publisherId:
						input.publisherId !== undefined
							? toEthereumAddress(input.publisherId)
							: undefined,
					msgChainId: input.msgChainId,
				},
				options
			);
		} else if (isQueryFrom(input)) {
			return this.fetchStream(
				QueryType.From,
				streamPartId,
				{
					fromTimestamp: new Date(input.from.timestamp).getTime(),
					fromSequenceNumber: input.from.sequenceNumber,
					publisherId:
						input.publisherId !== undefined
							? toEthereumAddress(input.publisherId)
							: undefined,
				},
				options
			);
		} else {
			throw new StreamrClientError(
				`can not query without valid query options: ${JSON.stringify({
					streamPartId,
					options: input,
				})}`,
				'INVALID_ARGUMENT'
			);
		}
	}

	private async fetchStream(
		queryType: QueryType,
		streamPartId: StreamPartID,
		query: HttpApiQueryDict,
		options?: QueryOptions
	): Promise<LogStoreMessageStream> {
		const traceId = randomString(5);
		this.logger.debug('Fetch query data', {
			loggerIdx: traceId,
			queryType,
			streamPartId,
			query,
		});

		const nodeUrl =
			this.logStoreClientConfig.nodeUrl ??
			(await this.nodeManager.getRandomNodeUrl());
		const url = this.createUrl(nodeUrl, queryType, streamPartId, {
			...query,
			// we will get raw request to desserialize and decrypt
			format: 'raw',
			verifyNetworkResponses: !!options?.verifyNetworkResponses,
		});
		const messageStream = options?.raw
			? new PushBuffer<string | StreamMessage<unknown>>()
			: this.messagePipelineFactory.createMessagePipeline({ streamPartId });

		const lines = transformError(
			this.httpUtil.fetchHttpStream(url, options?.abortSignal),
			getHttpErrorTransform()
		);

		const dataStream = defer(() => lines).pipe(
			shareReplay({
				refCount: true,
			}),
			map((line: string) => line.trim()), // remove ' ' and '\n' from the end of the line
			filter(Boolean), // remove empty lines
			map((line: string) => {
				const msgObject = JSON.parse(line);
				if (Array.isArray(msgObject)) {
					if (options?.raw) {
						return line;
					}
					return StreamMessage.deserialize(msgObject);
				}
				// last message must be metadata
				if (msgObject.type === 'metadata') {
					return msgObject as RequestMetadata;
				}
				throw new Error('Invalid message');
			})
		);

		const isStreamMessage = (msg: any): msg is StreamMessage | string =>
			msg instanceof StreamMessage || typeof msg === 'string';

		const [messagesSource, metadataSource] = partition(
			dataStream,
			isStreamMessage
		);

		setImmediate(async () => {
			await pull(messagesSource, messageStream);
		});

		const logStoreMessageStream = new LogStoreMessageStream(
			messageStream,
			metadataSource
		);

		if (options?.verifyNetworkResponses) {
			await validateWithNetworkResponses({
				queryInput: {
					query,
					queryType,
					streamPartId,
				},
				responseStream: logStoreMessageStream,
				systemMessages$: this.systemMessages$,
				nodeManager: this.nodeManager,
				logger: this.logger,
				queryUrl: nodeUrl,
				verificationOptions:
					typeof options.verifyNetworkResponses === 'object'
						? options.verifyNetworkResponses
						: undefined,
			});
		}

		return logStoreMessageStream;
	}

	createUrl(
		baseUrl: string,
		endpointSuffix: string,
		streamPartId: StreamPartID,
		query: HttpApiQueryDict | object = {}
	): string {
		const [streamId, streamPartition] =
			StreamPartIDUtils.getStreamIDAndPartition(streamPartId);
		const queryString = this.httpUtil.createQueryString(query);
		return `${baseUrl}/stores/${encodeURIComponent(
			streamId
		)}/data/partitions/${streamPartition}/${endpointSuffix}?${queryString}`;
	}

	getAuth() {
		return this.httpUtil.fetchAuthParams();
	}
}
