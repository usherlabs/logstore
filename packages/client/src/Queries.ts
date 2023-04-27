import { StreamPartIDUtils } from '@streamr/protocol';
import { EthereumAddress, Logger, toEthereumAddress } from '@streamr/utils';
import { StreamPartID } from 'streamr-client';
import { delay, inject, Lifecycle, scoped } from 'tsyringe';

import {
	LogStoreClientConfigInjectionToken,
	StrictLogStoreClientConfig,
} from './Config';
import { DestroySignal } from './DestroySignal';
import { GroupKeyManager } from './encryption/GroupKeyManager';
import { HttpUtil } from './HttpUtil';
import { LogStoreClient } from './LogStoreClient';
import { MessageStream } from './MessageStream';
import { NodeManager } from './registry/NodeManager';
import { StreamrClientError } from './StreamrClientError';
import { createSubscribePipeline } from './subscribe/subscribePipeline';
import { counting } from './utils/GeneratorUtils';
import { LoggerFactory } from './utils/LoggerFactory';
import { counterId } from './utils/utils';

const MIN_SEQUENCE_NUMBER_VALUE = 0;

export enum QueryType {
	Last = 'last',
	From = 'from',
	Range = 'range',
}

type QueryDict = Record<string, string | number | boolean | null | undefined>;

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
	private readonly nodeManager: NodeManager;
	private readonly httpUtil: HttpUtil;
	private readonly groupKeyManager: GroupKeyManager;
	private readonly destroySignal: DestroySignal;
	private readonly config: StrictLogStoreClientConfig;
	private readonly loggerFactory: LoggerFactory;
	private readonly logger: Logger;

	constructor(
		@inject(delay(() => LogStoreClient))
		logStoreClient: LogStoreClient,
		@inject(NodeManager)
		nodeManager: NodeManager,
		@inject(HttpUtil)
		httpUtil: HttpUtil,
		@inject(GroupKeyManager)
		groupKeyManager: GroupKeyManager,
		@inject(DestroySignal)
		destroySignal: DestroySignal,
		@inject(LogStoreClientConfigInjectionToken)
		config: StrictLogStoreClientConfig,
		@inject(LoggerFactory)
		loggerFactory: LoggerFactory
	) {
		this.logStoreClient = logStoreClient;
		this.nodeManager = nodeManager;
		this.httpUtil = httpUtil;
		this.groupKeyManager = groupKeyManager;
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
		query: QueryDict = {}
	): Promise<MessageStream> {
		const loggerIdx = counterId('fetchStream');
		this.logger.debug(
			'[%s] fetching query %s for %s with options %o',
			loggerIdx,
			queryType,
			streamPartId,
			query
		);

		const nodeUrl = await this.nodeManager.getRandomNodeUrl();
		const url = this.createUrl(nodeUrl, queryType, streamPartId, query);
		const messageStream = createSubscribePipeline({
			streamPartId,
			queries: this,
			groupKeyManager: this.groupKeyManager,
			logStoreClient: this.logStoreClient,
			destroySignal: this.destroySignal,
			config: this.config,
			loggerFactory: this.loggerFactory,
		});

		const dataStream = this.httpUtil.fetchHttpStream(url);
		messageStream.pull(
			counting(dataStream, (count: number) => {
				this.logger.debug(
					'[%s] total of %d messages received for query fetch',
					loggerIdx,
					count
				);
			})
		);
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
			count,
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
			fromTimestamp,
			fromSequenceNumber,
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
			fromTimestamp,
			fromSequenceNumber,
			toTimestamp,
			toSequenceNumber,
			publisherId,
			msgChainId,
		});
	}

	private createUrl(
		baseUrl: string,
		endpointSuffix: string,
		streamPartId: StreamPartID,
		query: QueryDict = {}
	): string {
		const queryMap = {
			...query,
			format: 'raw',
		};
		const [streamId, streamPartition] =
			StreamPartIDUtils.getStreamIDAndPartition(streamPartId);
		const queryString = this.httpUtil.createQueryString(queryMap);
		return `${baseUrl}/streams/${encodeURIComponent(
			streamId
		)}/data/partitions/${streamPartition}/${endpointSuffix}?${queryString}`;
	}
}
