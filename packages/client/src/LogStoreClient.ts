import type { Overrides } from '@ethersproject/contracts';
import type { Schema } from 'ajv';
import { ContractTransaction, Signer } from 'ethers';
import 'reflect-metadata';
import { map, share, switchMap } from 'rxjs';
import {
	MessageListener,
	Stream,
	StreamDefinition,
	StreamrClient,
} from 'streamr-client';
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
import { StreamObservableFactory } from './StreamObservableFactory';
import {
	Authentication,
	AuthenticationInjectionToken,
} from './streamr/Authentication';
import { StreamrClientConfigInjectionToken } from './streamr/Config';
import { ContractFactoryInjectionToken } from './streamr/ContractFactory';
import { DestroySignalInjectionToken } from './streamr/DestroySignal';
import { LoggerFactoryInjectionToken } from './streamr/LoggerFactory';
import {
	StreamIDBuilder,
	StreamIDBuilderInjectionToken,
} from './streamr/StreamIDBuilder';
import { StreamrClientInjectionToken } from './streamr/StreamrClient';
import { MessagePipelineFactoryInjectionToken } from './streamr/subscribe/MessagePipelineFactory';
import { AmountTypes } from './types';
import { BroadbandSubscriber } from './utils/BroadbandSubscriber';
import { GQtyClients } from './utils/GraphQLClient';
import {
	systemMessageFromSubscriber,
	SystemMessageObservable,
} from './utils/SystemMessageObservable';
import {
	LogStoreClientSystemMessagesInjectionToken,
	systemStreamFromClient,
} from './utils/systemStreamUtils';
import { ValidationManager } from './validationManager/ValidationManager';

export class LogStoreClient {
	private readonly authentication: Authentication;
	private readonly streamrClient: StreamrClient;
	private readonly logStoreRegistry: LogStoreRegistry;
	private readonly logStoreQueries: Queries;
	private readonly logStoreClientEventEmitter: LogStoreClientEventEmitter;
	private readonly logStoreQueryManager: QueryManager;
	private readonly logstoreTokenManager: TokenManager;
	private readonly validationManager: ValidationManager;
	private readonly strictLogStoreClientConfig: StrictLogStoreClientConfig;
	private readonly systemMessages$: SystemMessageObservable;
	private readonly streamObservableFactory: StreamObservableFactory;
	private readonly streamIdBuilder: StreamIDBuilder;

	constructor(
		streamrClient: StreamrClient,
		logStoreClientConfig: LogStoreClientConfig = {},
		/** @internal */
		parentContainer = rootContainer
	) {
		this.streamrClient = streamrClient;

		const container = parentContainer.createChildContainer();

		container.register(StreamrClientInjectionToken, {
			useValue: streamrClient,
		});

		container.register(StreamrClientConfigInjectionToken, {
			// @ts-expect-error config is marked as private in StreamrClient
			useValue: streamrClient.config,
		});

		this.strictLogStoreClientConfig = createStrictConfig(logStoreClientConfig);

		this.systemMessages$ = systemStreamFromClient(
			this.streamrClient,
			this.strictLogStoreClientConfig
		).pipe(
			map((stream) => new BroadbandSubscriber(this.streamrClient, stream)),
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

		// @ts-expect-error authentication is marked as private in StreamrClient
		this.authentication = streamrClient.authentication;
		container.register(AuthenticationInjectionToken, {
			// @ts-expect-error authentication is marked as private in StreamrClient
			useValue: streamrClient.authentication,
		});

		container.register(ContractFactoryInjectionToken, {
			// @ts-expect-error streamRegistry.contractFactory is marked as private in StreamrClient
			useValue: streamrClient.streamRegistry.contractFactory,
		});

		// @ts-expect-error streamIdBuilder is marked as private in StreamrClient
		this.streamIdBuilder = streamrClient.streamIdBuilder;
		container.register(StreamIDBuilderInjectionToken, {
			// @ts-expect-error streamIdBuilder is marked as private in StreamrClient
			useValue: streamrClient.streamIdBuilder,
		});

		container.register(DestroySignalInjectionToken, {
			// @ts-expect-error destroySignal is marked as private in StreamrClient
			useValue: streamrClient.destroySignal,
		});

		container.register(MessagePipelineFactoryInjectionToken, {
			// @ts-expect-error Property 'resends' is private and only accessible within class 'StreamrClient'
			useValue: streamrClient.resends.messagePipelineFactory,
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

		container.resolve<GQtyClients>(GQtyClients);

		this.logStoreClientEventEmitter =
			container.resolve<LogStoreClientEventEmitter>(LogStoreClientEventEmitter);

		this.logStoreRegistry =
			container.resolve<LogStoreRegistry>(LogStoreRegistry);

		this.logStoreQueries = container.resolve<Queries>(Queries);

		this.logStoreQueryManager = container.resolve<QueryManager>(QueryManager);

		this.logstoreTokenManager = container.resolve<TokenManager>(TokenManager);

		this.validationManager =
			container.resolve<ValidationManager>(ValidationManager);

		this.streamObservableFactory = container.resolve<StreamObservableFactory>(
			StreamObservableFactory
		);
	}

	async getSigner(): Promise<Signer> {
		return this.authentication.getStreamRegistryChainSigner();
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

	/**
	 * Retrieves the balance of a stream.
	 *
	 * @param {string} streamIdOrPath - The ID or path of the stream.
	 *
	 * @return {Promise<bigint>} The balance of the stream as a bigint.
	 */
	async getStreamBalance(streamIdOrPath: string): Promise<bigint> {
		return this.logStoreRegistry.getStreamBalance(streamIdOrPath);
	}

	/**
	 * Retrieves the balance of the store for this account.
	 */
	async getStoreBalance(): Promise<bigint> {
		return this.logStoreRegistry.getStoreBalance();
	}

	/**
	 * Sets the validation schema to validate new messages before storing on LogStore nodes.
	 */
	async setValidationSchema(
		...params: Parameters<ValidationManager['setValidationSchema']>
	): Promise<void> {
		return this.validationManager.setValidationSchema(...params);
	}

	/**
	 * Removes the validation schema from a stream.
	 */
	async removeValidationSchema(
		...params: Parameters<ValidationManager['removeValidationSchema']>
	): Promise<void> {
		return this.validationManager.removeValidationSchema(...params);
	}

	/**
	 * Retrieves the validation schema for a stream.
	 */
	async getValidationSchema(
		...params: Parameters<ValidationManager['getValidationSchema']>
	): Promise<Schema | null> {
		return this.validationManager.getValidationSchema(...params);
	}

	/**
	 * Extracts the validation schema for a stream from the stream metadata object.
	 */
	public getValidationSchemaFromStreamMetadata(
		...params: Parameters<
			ValidationManager['getValidationSchemaFromStreamMetadata']
		>
	): Promise<Schema | null> {
		return this.validationManager.getValidationSchemaFromStreamMetadata(
			...params
		);
	}

	// --------------------------------------------------------------------------------------------
	// Token utilities
	// --------------------------------------------------------------------------------------------

	async getBalance(): Promise<bigint> {
		return this.logstoreTokenManager.getBalance();
	}

	/**
	 * Mints tokens for the account, using MATIC. Tokens are used to stake for querying and storage.
	 */
	async mint(
		weiAmountToMint: bigint,
		overrides?: Overrides
	): Promise<ContractTransaction> {
		return this.logstoreTokenManager.mint(weiAmountToMint, overrides);
	}

	/**
	 * Gets price data for the token.
	 */
	async getPrice(): Promise<bigint> {
		return this.logstoreTokenManager.getPrice();
	}

	/**
	 * Gets conversion rate for the token, from/to multiple amount types.
	 */
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

	// --------------------------------------------------------------------------------------------
	// Events
	// --------------------------------------------------------------------------------------------

	/**
	 * Adds an event listener to the client.
	 * @param eventName - event name, see {@link LogStoreClientEvents} for options
	 * @param listener - the callback function
	 */
	on<T extends keyof LogStoreClientEvents>(
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
	once<T extends keyof LogStoreClientEvents>(
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
	off<T extends keyof LogStoreClientEvents>(
		eventName: T,
		listener: LogStoreClientEvents[T]
	): void {
		this.logStoreClientEventEmitter.off(eventName, listener as any);
	}

	/**
	 * Creates important observables for a stream.
	 *
	 * An observable is a stream of data that an observer can subscribe to.
	 * It provides a way to handle or execute tasks whenever an event occurs, such as metadata updates.
	 *
	 * @param params - Parameters for stream observable creation
	 * @returns A dictionary of observables that provides an alternative way to process stream data.
	 */
	public createStreamObservable(
		...params: Parameters<StreamObservableFactory['createStreamObservable']>
	) {
		return this.streamObservableFactory.createStreamObservable(...params);
	}
}
