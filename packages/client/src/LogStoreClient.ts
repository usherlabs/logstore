import type { Overrides } from '@ethersproject/contracts';
import type {
	MessageListener,
	Stream,
	StreamDefinition,
} from '@logsn/streamr-client';
import { StreamrClient as StreamrClientIntermediary } from '@logsn/streamr-client';
import { ContractTransaction } from 'ethers';
import 'reflect-metadata';
import { map, share, switchMap } from 'rxjs';
import StreamrClient, { StreamrClientConfig } from 'streamr-client';
import { container as rootContainer } from 'tsyringe';

import {
	createStrictConfig,
	LogStoreClientConfigInjectionToken,
	StrictLogStoreClientConfig,
} from './Config';
import { LogStoreClientEventEmitter, LogStoreClientEvents } from './events';
import { LogStoreClientConfig } from './LogStoreClientConfig';
import { LogStoreMessageStream } from './LogStoreMessageStream';
import {
	HttpApiQueryDict,
	Queries,
	QueryInput,
	type QueryOptions,
	QueryType,
} from './Queries';
import { LogStoreRegistry } from './registry/LogStoreRegistry';
import { QueryManager } from './registry/QueryManager';
import { TokenManager } from './registry/TokenManager';
import { AuthenticationInjectionToken } from './streamr/Authentication';
import { StreamrClientConfigInjectionToken } from './streamr/Config';
import { ContractFactoryInjectionToken } from './streamr/ContractFactory';
import { DestroySignalInjectionToken } from './streamr/DestroySignal';
import { GroupKeyManagerInjectionToken } from './streamr/encryption/GroupKeyManager';
import { LoggerFactoryInjectionToken } from './streamr/LoggerFactory';
import { StreamRegistryCachedInjectionToken } from './streamr/registry/StreamRegistryCached';
import { StreamIDBuilderInjectionToken } from './streamr/StreamIDBuilder';
import { AmountTypes } from './types';
import { BroadbandSubscriber } from './utils/BroadbandSubscriber';
import {
	systemMessageFromSubscriber,
	SystemMessageObservable,
} from './utils/SystemMessageObservable';
import {
	LogStoreClientSystemMessagesInjectionToken,
	systemStreamFromClient,
} from './utils/systemStreamUtils';

export class LogStoreClient extends StreamrClientIntermediary {
	private readonly logStoreRegistry: LogStoreRegistry;
	private readonly logStoreQueries: Queries;
	private readonly logStoreClientEventEmitter: LogStoreClientEventEmitter;
	private readonly logStoreQueryManager: QueryManager;
	private readonly logstoreTokenManager: TokenManager;
	private readonly strictLogStoreClientConfig: StrictLogStoreClientConfig;
	private readonly systemMessages$: SystemMessageObservable;

	constructor(
		streamrClient: StreamrClient,
		logStoreClientConfig: LogStoreClientConfig = {},
		streamrClientConfig: StreamrClientConfig = {},
		/** @internal */
		parentContainer = rootContainer
	) {
		const container = parentContainer.createChildContainer();

		container.register(StreamrClientConfigInjectionToken, {
			// @ts-expect-error config is marked as private in StreamrClient
			useValue: streamrClient.config,
		});

		super(streamrClientConfig, container);
		// TODO: Using parentContainer breaks authentication in the Broker's tests
		// super(streamrClientConfig, parentContainer);

		this.strictLogStoreClientConfig = createStrictConfig(logStoreClientConfig);

		this.systemMessages$ = systemStreamFromClient(this).pipe(
			map((stream) => new BroadbandSubscriber(this, stream)),
			switchMap(systemMessageFromSubscriber),
			// we share the observable so that multiple subscribers can listen to the same stream
			// and turn off the subscription when there are no more subscribers
			share({
				resetOnRefCountZero: true,
			})
		);

		container.register(LoggerFactoryInjectionToken, {
			// @ts-expect-error loggerFactory is marked as private in StreamrClient
			useValue: streamrClient.loggerFactory,
		});

		container.register(AuthenticationInjectionToken, {
			// @ts-expect-error authentication is marked as private in StreamrClient
			useValue: streamrClient.authentication,
		});

		container.register(ContractFactoryInjectionToken, {
			// @ts-expect-error streamRegistry.contractFactory is marked as private in StreamrClient
			useValue: streamrClient.streamRegistry.contractFactory,
		});

		container.register(StreamIDBuilderInjectionToken, {
			// @ts-expect-error streamIdBuilder is marked as private in StreamrClient
			useValue: streamrClient.streamIdBuilder,
		});

		container.register(DestroySignalInjectionToken, {
			// @ts-expect-error destroySignal is marked as private in StreamrClient
			useValue: streamrClient.destroySignal,
		});

		container.register(GroupKeyManagerInjectionToken, {
			// @ts-expect-error resends.groupKeyManager is marked as private in StreamrClient
			useValue: streamrClient.resends.groupKeyManager,
		});

		container.register(StreamRegistryCachedInjectionToken, {
			// @ts-expect-error resends.streamRegistryCached is marked as private in StreamrClient
			useValue: streamrClient.resends.streamRegistryCached,
		});

		container.register(LogStoreClient, {
			useValue: this,
		});

		container.register(LogStoreClientConfigInjectionToken, {
			useValue: this.strictLogStoreClientConfig,
		});

		container.register(LogStoreClientSystemMessagesInjectionToken, {
			useValue: this.systemMessages$,
		});

		this.logStoreClientEventEmitter =
			container.resolve<LogStoreClientEventEmitter>(LogStoreClientEventEmitter);

		this.logStoreRegistry =
			container.resolve<LogStoreRegistry>(LogStoreRegistry);

		this.logStoreQueries = container.resolve<Queries>(Queries);

		this.logStoreQueryManager = container.resolve<QueryManager>(QueryManager);

		this.logstoreTokenManager = container.resolve<TokenManager>(TokenManager);
	}

	// --------------------------------------------------------------------------------------------
	// Query
	// --------------------------------------------------------------------------------------------

	/**
	 * Stake funds so can query
	 */
	async queryStake(
		amount: bigint,
		options = { usd: false },
		overrides?: Overrides
	) {
		return this.logStoreQueryManager.queryStake(
			amount,
			{ usd: options.usd },
			overrides
		);
	}

	/**
	 * Performs a query of stored historical data.
	 *
	 * @category Important
	 *
	 * @param streamDefinition - the stream partition for which data should be resent
	 * @param input - defines the kind of query that should be performed
	 * @param onMessage - callback will be invoked for each message retrieved
	 * @returns a {@link MessageStream} that provides an alternative way of iterating messages. Rejects if the stream is
	 * not stored (i.e. is not assigned to a storage node).
	 */
	async query(
		streamDefinition: StreamDefinition,
		input: QueryInput,
		onMessage?: MessageListener,
		options?: QueryOptions
	): Promise<LogStoreMessageStream> {
		const streamPartId = await this.streamIdBuilder.toStreamPartID(
			streamDefinition
		);
		const messageStream = await this.logStoreQueries.query(
			streamPartId,
			input,
			options
		);
		if (onMessage !== undefined) {
			messageStream.useLegacyOnMessageHandler(onMessage);
		}
		return messageStream;
	}

	async getQueryBalance(): Promise<bigint> {
		return this.logStoreQueryManager.getQueryBalance();
	}

	async createQueryUrl(
		nodeUrl: string,
		streamDefinition: StreamDefinition,
		type: QueryType | string,
		queryParams: HttpApiQueryDict
	) {
		const streamPartId = await this.streamIdBuilder.toStreamPartID(
			streamDefinition
		);

		const url = this.logStoreQueries.createUrl(
			nodeUrl,
			type,
			streamPartId,
			queryParams
		);

		return url;
	}

	apiAuth() {
		return this.logStoreQueries.getAuth();
	}

	// --------------------------------------------------------------------------------------------
	// LogStore
	// --------------------------------------------------------------------------------------------

	/**
	 * Add a stream to LogStore.
	 */
	async stakeOrCreateStore(
		streamIdOrPath: string,
		amount: bigint,
		overrides?: Overrides
	): Promise<ContractTransaction> {
		return this.logStoreRegistry.stakeOrCreateStore(
			streamIdOrPath,
			amount,
			overrides
		);
	}

	/**
	 * Checks whether a stream is assigned to a storage node.
	 */
	async isLogStoreStream(streamIdOrPath: string): Promise<boolean> {
		return this.logStoreRegistry.isLogStoreStream(streamIdOrPath);
	}

	/**
	 * Gets all streams assigned to a storage node.
	 *
	 * @returns a list of {@link Stream} as well as `blockNumber` of result (i.e. blockchain state)
	 */
	async getLogStoreStreams(): Promise<{
		streams: Stream[];
		blockNumber: number;
	}> {
		return this.logStoreRegistry.getStoredStreams();
	}

	async getStreamBalance(streamIdOrPath: string): Promise<bigint> {
		return this.logStoreRegistry.getStreamBalance(streamIdOrPath);
	}

	async getStoreBalance(): Promise<bigint> {
		return this.logStoreRegistry.getStoreBalance();
	}

	// --------------------------------------------------------------------------------------------
	// Token utilities
	// --------------------------------------------------------------------------------------------

	async getBalance(): Promise<bigint> {
		return this.logstoreTokenManager.getBalance();
	}

	async mint(
		weiAmountToMint: bigint,
		overrides?: Overrides
	): Promise<ContractTransaction> {
		return this.logstoreTokenManager.mint(weiAmountToMint, overrides);
	}

	async getPrice(): Promise<bigint> {
		return this.logstoreTokenManager.getPrice();
	}

	async convert({
		amount,
		from,
		to,
	}: {
		amount: string;
		from: AmountTypes;
		to: AmountTypes;
	}): Promise<string> {
		return this.logstoreTokenManager.convert({ amount, from, to });
	}

	// --------------------------------------------------------------------------------------------
	// Client
	// --------------------------------------------------------------------------------------------

	getConfig(): LogStoreClientConfig {
		return this.strictLogStoreClientConfig;
	}

	/**
	 * Destroys an instance of a {@link StreamrClient} by disconnecting from peers, clearing any pending tasks, and
	 * freeing up resources. This should be called once a user is done with the instance.
	 *
	 * @remarks As the name implies, the client instance (or any streams or subscriptions returned by it) should _not_
	 * be used after calling this method.
	 */
	override destroy(): Promise<void> {
		this.logStoreClientEventEmitter.removeAllListeners();
		return super.destroy();
	}

	// --------------------------------------------------------------------------------------------
	// Events
	// --------------------------------------------------------------------------------------------

	/**
	 * Adds an event listener to the client.
	 * @param eventName - event name, see {@link LogStoreClientEvents} for options
	 * @param listener - the callback function
	 */
	override on<T extends keyof LogStoreClientEvents>(
		eventName: T,
		listener: LogStoreClientEvents[T]
	): void {
		this.logStoreClientEventEmitter.on(eventName, listener as any);
	}

	/**
	 * Adds an event listener to the client that is invoked only once.
	 * @param eventName - event name, see {@link LogStoreClientEvents} for options
	 * @param listener - the callback function
	 */
	override once<T extends keyof LogStoreClientEvents>(
		eventName: T,
		listener: LogStoreClientEvents[T]
	): void {
		this.logStoreClientEventEmitter.once(eventName, listener as any);
	}

	/**
	 * Removes an event listener from the client.
	 * @param eventName - event name, see {@link LogStoreClientEvents} for options
	 * @param listener - the callback function to remove
	 */
	override off<T extends keyof LogStoreClientEvents>(
		eventName: T,
		listener: LogStoreClientEvents[T]
	): void {
		this.logStoreClientEventEmitter.off(eventName, listener as any);
	}
}
