import {
	createSubscribePipeline,
	IResends,
	MessageStream,
	StreamPartID,
	StreamrClientError,
} from '@logsn/streamr-client';
import { StreamMessage, StreamPartIDUtils } from '@streamr/protocol';
import { EthereumAddress, Logger, toEthereumAddress } from '@streamr/utils';
import { defer, EMPTY, partition, shareReplay } from 'rxjs';
import { inject, Lifecycle, scoped } from 'tsyringe';

import { LogStoreClientConfigInjectionToken } from './Config';
import { HttpUtil } from './HttpUtil';
import { LogStoreMessageStream } from './LogStoreMessageStream';
import { NodeManager } from './registry/NodeManager';
import { StrictStreamrClientConfig } from './streamr/Config';
import {
	DestroySignal,
	DestroySignalInjectionToken,
} from './streamr/DestroySignal';
import {
	GroupKeyManager,
	GroupKeyManagerInjectionToken,
} from './streamr/encryption/GroupKeyManager';
import {
	LoggerFactory,
	LoggerFactoryInjectionToken,
} from './streamr/LoggerFactory';
import {
	StreamRegistryCached,
	StreamRegistryCachedInjectionToken,
} from './streamr/registry/StreamRegistryCached';
import { counting } from './streamr/utils/GeneratorUtils';
import {
	validateWithNetworkResponses,
	type VerificationOptions,
} from './utils/networkValidation/validateNetworkResponses';
import { SystemMessageObservable } from './utils/SystemMessageObservable';
import { LogStoreClientSystemMessagesInjectionToken } from './utils/systemStreamUtils';
import { counterId } from './utils/utils';

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
	verifyNetworkResponses?: VerificationOptions | boolean;
};

@scoped(Lifecycle.ContainerScoped)
export class Queries implements IResends {
	private readonly streamRegistryCached: StreamRegistryCached;
	private readonly nodeManager: NodeManager;
	private readonly httpUtil: HttpUtil;
	private readonly groupKeyManager: GroupKeyManager;
	private readonly destroySignal: DestroySignal;
	private readonly config: StrictStreamrClientConfig;
	private readonly loggerFactory: LoggerFactory;
	private readonly logger: Logger;

	constructor(
		@inject(StreamRegistryCachedInjectionToken)
		streamRegistryCached: StreamRegistryCached,
		@inject(NodeManager)
		nodeManager: NodeManager,
		@inject(HttpUtil)
		httpUtil: HttpUtil,
		@inject(GroupKeyManagerInjectionToken)
		groupKeyManager: GroupKeyManager,
		@inject(DestroySignalInjectionToken)
		destroySignal: DestroySignal,
		@inject(LogStoreClientConfigInjectionToken)
		config: StrictStreamrClientConfig,
		@inject(LoggerFactoryInjectionToken)
		loggerFactory: LoggerFactory,
		@inject(LogStoreClientSystemMessagesInjectionToken)
		private systemMessages$: SystemMessageObservable
	) {
		this.streamRegistryCached = streamRegistryCached;
		this.nodeManager = nodeManager;
		this.httpUtil = httpUtil;
		this.groupKeyManager = groupKeyManager;
		this.destroySignal = destroySignal;
		this.config = config;
		this.loggerFactory = loggerFactory;
		this.logger = loggerFactory.createLogger(module);
	}

	async query(
		streamPartId: StreamPartID,
		input: QueryInput,
		options?: QueryOptions
	): Promise<LogStoreMessageStream> {
		if (isQueryLast(input)) {
			const inputObject = {
				count: input.last,
			};
			return this.last(streamPartId, inputObject, options);
		}

		if (isQueryRange(input)) {
			return this.logStoreRange(
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
		}

		if (isQueryFrom(input)) {
			return this.from(
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
		}

		throw new StreamrClientError(
			`can not query without valid query options: ${JSON.stringify({
				streamPartId,
				options: input,
			})}`,
			'INVALID_ARGUMENT'
		);
	}

	private async fetchStream(
		queryType: QueryType,
		streamPartId: StreamPartID,
		query: HttpApiQueryDict,
		options?: QueryOptions
	): Promise<LogStoreMessageStream> {
		const loggerIdx = counterId('fetchStream');
		this.logger.debug(
			'[%s] fetching query %s for %s with options %o',
			loggerIdx,
			queryType,
			streamPartId,
			query
		);

		const nodeUrl = await this.nodeManager.getRandomNodeUrl();
		const url = this.createUrl(nodeUrl, queryType, streamPartId, {
			...query,
			// we will get raw request to desserialize and decrypt
			format: 'raw',
			verifyNetworkResponses: !!options?.verifyNetworkResponses,
		});
		const messageStream = createSubscribePipeline({
			streamPartId,
			resends: this,
			// @ts-expect-error createSubscribePipeline expects groupKeyManager to has private properties that not defined by the interface
			groupKeyManager: this.groupKeyManager,
			// @ts-expect-error createSubscribePipeline expects streamRegistryCached to has private properties that not defined by the interface
			streamRegistryCached: this.streamRegistryCached,
			// @ts-expect-error createSubscribePipeline expects destroySignal to has private properties that not defined by the interface
			destroySignal: this.destroySignal,
			config: this.config,
			// @ts-expect-error createSubscribePipeline expects loggerFactory to has private properties that not defined by the interface
			loggerFactory: this.loggerFactory,
		});

		const dataStream = defer(() => this.httpUtil.fetchHttpStream(url)).pipe(
			shareReplay({
				refCount: true,
			})
		);

		const isStreamMessage = (msg: any): msg is StreamMessage =>
			msg instanceof StreamMessage;

		const [messagesSource, metadataSource] = partition(
			dataStream,
			isStreamMessage
		);

		const countedSource$ = defer(() =>
			counting(messagesSource, (count: number) => {
				this.logger.debug(
					'[%s] total of %d messages received for query fetch',
					loggerIdx,
					count
				);
			})
		);

		const logStoreMessageStream = new LogStoreMessageStream(
			messageStream,
			metadataSource
		);

		logStoreMessageStream.setSourceOnStart(countedSource$);

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

	private async last(
		streamPartId: StreamPartID,
		{ count }: { count: number },
		options?: QueryOptions
	): Promise<LogStoreMessageStream> {
		if (count <= 0) {
			const emptyStream = new MessageStream();
			emptyStream.endWrite();
			return new LogStoreMessageStream(emptyStream, EMPTY);
		}

		return this.fetchStream(
			QueryType.Last,
			streamPartId,
			{
				count,
			},
			options
		);
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
		},
		options?: QueryOptions
	): Promise<LogStoreMessageStream> {
		return this.fetchStream(
			QueryType.From,
			streamPartId,
			{
				fromTimestamp,
				fromSequenceNumber,
				publisherId,
			},
			options
		);
	}

	async logStoreRange(
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
		},
		options?: QueryOptions
	): Promise<LogStoreMessageStream> {
		const logStoreStream = await this.fetchStream(
			QueryType.Range,
			streamPartId,
			{
				fromTimestamp,
				fromSequenceNumber,
				toTimestamp,
				toSequenceNumber,
				publisherId,
				msgChainId,
			},
			options
		);

		return logStoreStream;
	}

	/**
	 * @internal
	 */
	async range(
		...args: Parameters<Queries['logStoreRange']>
	): Promise<MessageStream> {
		const logStoreStream = await this.logStoreRange(...args);
		// This is still returning messageStream, as to be a valid Resend class,
		// it must not ovewrite this type. It is used when we create the subscription pipeline
		return logStoreStream.messageStream;
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
		return `${baseUrl}/streams/${encodeURIComponent(
			streamId
		)}/data/partitions/${streamPartition}/${endpointSuffix}?${queryString}`;
	}

	getAuth() {
		return this.httpUtil.fetchAuthParams();
	}
}
