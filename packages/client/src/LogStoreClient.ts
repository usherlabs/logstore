import { cloneDeep } from 'lodash';
import StreamrClient, {
	MessageListener,
	NetworkNodeStub,
	Stream,
	StreamDefinition,
} from 'streamr-client';
import { container } from 'tsyringe';

import {
	AuthenticationInjectionToken,
	createAuthentication,
} from './Authentication';
import {
	createStrictConfig,
	LogStoreClientConfigInjectionToken,
} from './Config';
import { LogStoreClientEventEmitter, LogStoreClientEvents } from './events';
import { LogStoreClientConfig } from './LogStoreClientConfig';
import { MessageStream } from './MessageStream';
import { Queries, QueryOptions } from './Queries';
import { LogStoreRegistry } from './registry/LogStoreRegistry';
import { StreamIDBuilder } from './StreamIDBuilder';

export class LogStoreClient extends StreamrClient {
	// TODO: logStoreRegistry must be private (it's a temporary hotfix)
	public readonly logStoreRegistry: LogStoreRegistry;
	private readonly logStoreQueries: Queries;
	private readonly logStoreStreamIdBuilder: StreamIDBuilder;
	private readonly logStoreClientEventEmitter: LogStoreClientEventEmitter;

	constructor(config: LogStoreClientConfig = {}) {
		// TODO: Review needed. Make the call of super(streamrClientConfig) pass its config validation.
		const streamrClientConfig = cloneDeep(config);
		delete streamrClientConfig.contracts?.logStoreManagerChainAddress;
		delete streamrClientConfig.contracts?.logStoreTheGraphUrl;
		super(streamrClientConfig);

		const strictConfig = createStrictConfig(config);
		const authentication = createAuthentication(strictConfig);

		container.register(LogStoreClient, {
			useValue: this,
		});

		container.register(LogStoreClientConfigInjectionToken, {
			useValue: config,
		});

		container.register(AuthenticationInjectionToken, {
			useValue: authentication,
		});

		this.logStoreClientEventEmitter =
			container.resolve<LogStoreClientEventEmitter>(LogStoreClientEventEmitter);

		this.logStoreRegistry =
			container.resolve<LogStoreRegistry>(LogStoreRegistry);

		this.logStoreStreamIdBuilder =
			container.resolve<StreamIDBuilder>(StreamIDBuilder);
		this.logStoreQueries = container.resolve<Queries>(Queries);
	}

	// --------------------------------------------------------------------------------------------
	// Network node
	// --------------------------------------------------------------------------------------------

	// TODO: getNode() is marked and deprecated in StreamrClient class. Needs to resolve.
	override getNode(): Promise<NetworkNodeStub> {
		return super.getNode();
	}

	// --------------------------------------------------------------------------------------------
	// Query
	// --------------------------------------------------------------------------------------------

	/**
	 * Performs a query of stored historical data.
	 *
	 * @category Important
	 *
	 * @param streamDefinition - the stream partition for which data should be resent
	 * @param options - defines the kind of query that should be performed
	 * @param onMessage - callback will be invoked for each message retrieved
	 * @returns a {@link MessageStream} that provides an alternative way of iterating messages. Rejects if the stream is
	 * not stored (i.e. is not assigned to a storage node).
	 */
	async query(
		streamDefinition: StreamDefinition,
		options: QueryOptions,
		onMessage?: MessageListener
	): Promise<MessageStream> {
		const streamPartId = await this.logStoreStreamIdBuilder.toStreamPartID(
			streamDefinition
		);
		const messageStream = await this.logStoreQueries.query(
			streamPartId,
			options
		);
		if (onMessage !== undefined) {
			messageStream.useLegacyOnMessageHandler(onMessage);
		}
		return messageStream;
	}

	// --------------------------------------------------------------------------------------------
	// LogStore
	// --------------------------------------------------------------------------------------------

	/**
	 * Aввы a stream to LogStore.
	 */
	async addStreamToLogStore(streamIdOrPath: string): Promise<void> {
		return this.logStoreRegistry.addStreamToLogStore(streamIdOrPath);
	}

	/**
	 * Removes a stream from LogStore.
	 */
	async removeStreamFromLogStore(streamIdOrPath: string): Promise<void> {
		return this.logStoreRegistry.removeStreamFromLogStore(streamIdOrPath);
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

	// /**
	//  * Gets a list of storage nodes.
	//  *
	//  * @param streamIdOrPath - if a stream is given, returns the list of storage nodes the stream has been assigned to;
	//  * leave as `undefined` to return all storage nodes
	//  */
	// async getStorageNodes(streamIdOrPath?: string): Promise<EthereumAddress[]> {
	// 	return this.streamStorageRegistry.getStorageNodes(streamIdOrPath);
	// }

	// /**
	//  * Sets the metadata of a storage node in the storage node registry.
	//  *
	//  * @remarks Acts on behalf of the wallet associated with the current {@link StreamrClient} instance.
	//  *
	//  * @param metadata - if `undefined`, removes the storage node from the registry
	//  */
	// setStorageNodeMetadata(
	// 	metadata: StorageNodeMetadata | undefined
	// ): Promise<void> {
	// 	return this.storageNodeRegistry.setStorageNodeMetadata(metadata);
	// }

	// /**
	//  * Gets the metadata of a storage node from the storage node registry.
	//  *
	//  * @returns rejects if the storage node is not found
	//  */
	// async getStorageNodeMetadata(
	// 	nodeAddress: string
	// ): Promise<StorageNodeMetadata> {
	// 	return this.storageNodeRegistry.getStorageNodeMetadata(
	// 		toEthereumAddress(nodeAddress)
	// 	);
	// }

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
