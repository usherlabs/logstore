import {
	QueryMessage,
	QueryMessageType,
	QueryRequest,
	QueryResponse,
	QueryType,
} from '@concertodao/logstore-protocol';
import { StreamMessage, StreamPartIDUtils } from '@streamr/protocol';
import { EthereumAddress, Logger, toEthereumAddress } from '@streamr/utils';
import { StreamPartID } from 'streamr-client';
import { delay, inject, Lifecycle, scoped } from 'tsyringe';

import {
	LogStoreClientConfigInjectionToken,
	StrictLogStoreClientConfig,
} from './Config';
import { DestroySignal } from './DestroySignal';
import { LogStoreClient } from './LogStoreClient';
// import { GroupKeyManager } from './encryption/GroupKeyManager';
import { MessageStream } from './MessageStream';
import { LogStoreRegistry } from './registry/LogStoreRegistry';
import { StreamrClientError } from './StreamrClientError';
import { LoggerFactory } from './utils/LoggerFactory';
import { counterId, formLogStoreQueryStreamId } from './utils/utils';
import { uuid } from './utils/uuid';

const MIN_SEQUENCE_NUMBER_VALUE = 0;

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
export type QueryOptions =
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

@scoped(Lifecycle.ContainerScoped)
export class Queries {
	private readonly logStoreClient: LogStoreClient;
	private readonly logStoreRegistry: LogStoreRegistry;
	// private readonly groupKeyManager: GroupKeyManager;
	private readonly destroySignal: DestroySignal;
	private readonly config: StrictLogStoreClientConfig;
	private readonly loggerFactory: LoggerFactory;
	private readonly logger: Logger;

	constructor(
		@inject(delay(() => LogStoreClient)) logStoreClient: LogStoreClient,
		@inject(delay(() => LogStoreRegistry)) logStoreRegistry: LogStoreRegistry,
		// groupKeyManager: GroupKeyManager,
		destroySignal: DestroySignal,
		@inject(LogStoreClientConfigInjectionToken)
		config: StrictLogStoreClientConfig,
		@inject(LoggerFactory) loggerFactory: LoggerFactory
	) {
		this.logStoreClient = logStoreClient;
		this.logStoreRegistry = logStoreRegistry;
		// this.groupKeyManager = groupKeyManager;
		this.destroySignal = destroySignal;
		this.config = config;
		this.loggerFactory = loggerFactory;
		this.logger = loggerFactory.createLogger(module);
	}

	query(
		streamPartId: StreamPartID,
		options: QueryOptions
	): Promise<MessageStream> {
		if (isQueryLast(options)) {
			return this.last(streamPartId, {
				count: options.last,
			});
		}

		if (isQueryRange(options)) {
			return this.range(streamPartId, {
				fromTimestamp: new Date(options.from.timestamp).getTime(),
				fromSequenceNumber: options.from.sequenceNumber,
				toTimestamp: new Date(options.to.timestamp).getTime(),
				toSequenceNumber: options.to.sequenceNumber,
				publisherId:
					options.publisherId !== undefined
						? toEthereumAddress(options.publisherId)
						: undefined,
				msgChainId: options.msgChainId,
			});
		}

		if (isQueryFrom(options)) {
			return this.from(streamPartId, {
				fromTimestamp: new Date(options.from.timestamp).getTime(),
				fromSequenceNumber: options.from.sequenceNumber,
				publisherId:
					options.publisherId !== undefined
						? toEthereumAddress(options.publisherId)
						: undefined,
			});
		}

		throw new StreamrClientError(
			`can not query without valid query options: ${JSON.stringify({
				streamPartId,
				options,
			})}`,
			'INVALID_ARGUMENT'
		);
	}

	private async fetchStream(
		queryType: QueryType,
		streamPartId: StreamPartID,
		queryOptions: QueryOptions
	): Promise<MessageStream> {
		const loggerIdx = counterId('fetchStream');
		this.logger.debug(
			'[%s] fetching query %s for %s with options %o',
			loggerIdx,
			queryType,
			streamPartId,
			queryOptions
		);
		const streamId = StreamPartIDUtils.getStreamID(streamPartId);
		const requestId = uuid();
		const queryRequest = new QueryRequest({
			requestId,
			streamId,
			queryType,
			queryOptions,
		});

		const queryStreamId = formLogStoreQueryStreamId(
			this.config.contracts.logStoreManagerChainAddress
		);

		const messageStream = new MessageStream();

		await this.logStoreClient.publish(queryStreamId, queryRequest.serialize());

		await new Promise<void>((resolve, reject) => {
			this.logStoreClient
				.subscribe(queryStreamId, (content) => {
					const qyeryMessage = QueryMessage.deserialize(content);
					if (
						qyeryMessage.messageType === QueryMessageType.QueryResponse &&
						qyeryMessage.requestId === requestId
					) {
						const queryResponse = qyeryMessage as QueryResponse;
						this.logger.trace(
							'Received queryResponse: %s',
							JSON.stringify(queryResponse.payload, null, 2)
						);

						if (!queryResponse.isFinal) {
							const streamMessage = StreamMessage.deserialize(
								queryResponse.payload
							);
							messageStream.push(streamMessage);
						} else {
							messageStream.endWrite();
							resolve();
						}
					} else {
						// TODO:
					}
				})
				// .then(async (subscription) => {
				// 	await subscription.unsubscribe();
				// })
				.catch(reject);
		});

		return messageStream;
	}

	async last(
		streamPartId: StreamPartID,
		{ count }: { count: number }
	): Promise<MessageStream> {
		if (count <= 0) {
			const emptyStream = new MessageStream();
			emptyStream.endWrite();
			return emptyStream;
		}

		return this.fetchStream(QueryType.Last, streamPartId, {
			last: count,
		});
	}

	private async from(
		streamPartId: StreamPartID,
		{
			fromTimestamp,
			fromSequenceNumber = MIN_SEQUENCE_NUMBER_VALUE,
			publisherId,
		}: {
			fromTimestamp: number;
			fromSequenceNumber?: number;
			publisherId?: EthereumAddress;
		}
	): Promise<MessageStream> {
		return this.fetchStream(QueryType.From, streamPartId, {
			from: {
				timestamp: fromTimestamp,
				sequenceNumber: fromSequenceNumber,
			},
			publisherId,
		});
	}

	async range(
		streamPartId: StreamPartID,
		{
			fromTimestamp,
			fromSequenceNumber = MIN_SEQUENCE_NUMBER_VALUE,
			toTimestamp,
			toSequenceNumber = MIN_SEQUENCE_NUMBER_VALUE,
			publisherId,
			msgChainId,
		}: {
			fromTimestamp: number;
			fromSequenceNumber?: number;
			toTimestamp: number;
			toSequenceNumber?: number;
			publisherId?: EthereumAddress;
			msgChainId?: string;
		}
	): Promise<MessageStream> {
		return this.fetchStream(QueryType.Range, streamPartId, {
			from: {
				timestamp: fromTimestamp,
				sequenceNumber: fromSequenceNumber,
			},
			to: {
				timestamp: toTimestamp,
				sequenceNumber: toSequenceNumber,
			},
			publisherId,
			msgChainId,
		});
	}
}
