import type {
	Authentication,
	EthereumAddress,
	Message,
	MessageListener,
	MessageStream,
	NetworkNodeStub,
	PermissionAssignment,
	PermissionQuery,
	ProxyDirection,
	PublishMetadata,
	ResendOptions,
	SearchStreamsPermissionFilter,
	StorageNodeMetadata,
	Stream,
	StreamDefinition,
	StreamMetadata,
	StreamrClientConfig,
	StreamrClientEvents,
	Subscription,
	UpdateEncryptionKeyOptions,
} from '@logsn/streamr-client';

/**
 * The main API used to interact with Streamr.
 *
 * @category Important
 */
export interface IStreamrClient {
	readonly generateEthereumAccount: () => {
		address: string;
		privateKey: string;
	};
	readonly id: string;
	readonly config: StreamrClientConfig;
	readonly node: any;
	readonly authentication: Authentication;
	readonly resends: any;
	readonly publisher: any;
	readonly subscriber: any;
	readonly localGroupKeyStore: any;
	readonly destroySignal: any;
	readonly streamRegistry: any;
	readonly streamStorageRegistry: any;
	readonly storageNodeRegistry: any;
	readonly loggerFactory: any;
	readonly streamIdBuilder: any;
	readonly eventEmitter: any;

	/**
	 * Publishes a message to a stream partition in the network.
	 *
	 * @category Important
	 *
	 * @param streamDefinition - the stream or stream partition to publish the message to
	 * @param content - the content (the payload) of the message (must be JSON serializable)
	 * @param metadata - provide additional metadata to be included in the message or to control the publishing process
	 * @returns the published message (note: the field {@link Message.content} is encrypted if the stream is private)
	 */
	publish(
		streamDefinition: StreamDefinition,
		content: unknown,
		metadata?: PublishMetadata
	): Promise<Message>;
	/**
	 * Manually updates the encryption key used when publishing messages to a given stream.
	 */
	updateEncryptionKey(opts: UpdateEncryptionKeyOptions): Promise<void>;
	/**
	 * Adds an encryption key for a given publisher to the key store.
	 *
	 * @remarks Keys will be added to the store automatically by the client as encountered. This method can be used to
	 * manually add some known keys into the store.
	 */
	addEncryptionKey(key: any, publisherId: EthereumAddress): Promise<void>;
	/**
	 * Subscribes to a stream partition in the network.
	 *
	 * @category Important
	 *
	 * @param options - the stream or stream partition to subscribe to,
	 * additionally a resend can be performed by providing resend options
	 * @param onMessage - callback will be invoked for each message received in subscription
	 * @returns a {@link Subscription} that can be used to manage the subscription etc.
	 */
	subscribe(
		options: StreamDefinition & {
			resend?: ResendOptions;
		},
		onMessage?: MessageListener
	): Promise<Subscription>;
	/**
	 * Unsubscribes from streams or stream partitions in the network.
	 *
	 * @remarks no-op if subscription does not exist
	 *
	 * @category Important
	 *
	 * @param streamDefinitionOrSubscription - leave as `undefined` to unsubscribe from all existing subscriptions.
	 */
	unsubscribe(
		streamDefinitionOrSubscription?: StreamDefinition | Subscription
	): Promise<unknown>;
	/**
	 * Returns a list of subscriptions matching the given criteria.
	 *
	 * @category Important
	 *
	 * @param streamDefinition - leave as `undefined` to get all subscriptions
	 */
	getSubscriptions(
		streamDefinition?: StreamDefinition
	): Promise<Subscription[]>;
	/**
	 * Performs a resend of stored historical data.
	 *
	 * @category Important
	 *
	 * @param streamDefinition - the stream partition for which data should be resent
	 * @param options - defines the kind of resend that should be performed
	 * @param onMessage - callback will be invoked for each message retrieved
	 * @returns a {@link MessageStream} that provides an alternative way of iterating messages. Rejects if the stream is
	 * not stored (i.e. is not assigned to a storage node).
	 */
	resend(
		streamDefinition: StreamDefinition,
		options: ResendOptions,
		onMessage?: MessageListener
	): Promise<MessageStream>;
	/**
	 * Waits for a message to be stored by a storage node.
	 *
	 * @param message - the message to be awaited for
	 * @param options - additional options for controlling waiting and message matching
	 * @returns rejects if message was found in storage before timeout
	 */
	waitForStorage(
		message: Message,
		options?: {
			/**
			 * Determines how often should storage node be polled.
			 */
			interval?: number;
			/**
			 * Timeout after which to give up if message was not seen.
			 */
			timeout?: number;
			/**
			 * Controls size of internal resend used in polling.
			 */
			count?: number;
		}
	): Promise<void>;
	/**
	 * Gets a stream.
	 *
	 * @category Important
	 *
	 * @returns rejects if the stream is not found
	 */
	getStream(streamIdOrPath: string): Promise<Stream>;
	/**
	 * Creates a new stream.
	 *
	 * @category Important
	 *
	 * @param propsOrStreamIdOrPath - the stream id to be used for the new stream, and optionally, any
	 * associated metadata
	 */
	createStream(
		propsOrStreamIdOrPath:
			| (Partial<StreamMetadata> & {
					id: string;
			  })
			| string
	): Promise<Stream>;
	/**
	 * Gets a stream, creating one if it does not exist.
	 *
	 * @category Important
	 *
	 * @param props - the stream id to get or create. Field `partitions` is only used if creating the stream.
	 */
	getOrCreateStream(props: {
		id: string;
		partitions?: number;
	}): Promise<Stream>;
	/**
	 * Updates the metadata of a stream.
	 *
	 * @param props - the stream id and the metadata fields to be updated
	 */
	updateStream(
		props: Partial<StreamMetadata> & {
			id: string;
		}
	): Promise<Stream>;
	/**
	 * Deletes a stream.
	 */
	deleteStream(streamIdOrPath: string): Promise<void>;
	/**
	 * Searches for streams based on given criteria.
	 *
	 * @param term - a search term that should be part of the stream id of a result
	 * @param permissionFilter - permissions that should be in effect for a result
	 */
	searchStreams(
		term: string | undefined,
		permissionFilter: SearchStreamsPermissionFilter | undefined
	): AsyncIterable<Stream>;
	/**
	 * Gets all ethereum addresses that have {@link StreamPermission.PUBLISH} permission to the stream.
	 */
	getStreamPublishers(streamIdOrPath: string): AsyncIterable<EthereumAddress>;
	/**
	 * Gets all ethereum addresses that have {@link StreamPermission.SUBSCRIBE} permission to the stream.
	 */
	getStreamSubscribers(streamIdOrPath: string): AsyncIterable<EthereumAddress>;
	/**
	 * Checks whether the given permission is in effect.
	 */
	hasPermission(query: PermissionQuery): Promise<boolean>;
	/**
	 * Returns the list of all permissions in effect for a given stream.
	 */
	getPermissions(streamIdOrPath: string): Promise<PermissionAssignment[]>;
	/**
	 * Grants permissions on a given stream.
	 */
	grantPermissions(
		streamIdOrPath: string,
		...assignments: PermissionAssignment[]
	): Promise<void>;
	/**
	 * Revokes permissions on a given stream.
	 */
	revokePermissions(
		streamIdOrPath: string,
		...assignments: PermissionAssignment[]
	): Promise<void>;
	/**
	 * Sets a list of permissions to be in effect.
	 *
	 * @remarks Can be used to set the permissions of multiple streams in one transaction. Great for doing bulk
	 * operations and saving gas costs. Notice that the behaviour is overwriting, therefore any existing permissions not
	 * defined will be removed (per stream).
	 */
	setPermissions(
		...items: {
			streamId: string;
			assignments: PermissionAssignment[];
		}[]
	): Promise<void>;
	/**
	 * Checks whether a given ethereum address has {@link StreamPermission.PUBLISH} permission to a stream.
	 */
	isStreamPublisher(
		streamIdOrPath: string,
		userAddress: string
	): Promise<boolean>;
	/**
	 * Checks whether a given ethereum address has {@link StreamPermission.SUBSCRIBE} permission to a stream.
	 */
	isStreamSubscriber(
		streamIdOrPath: string,
		userAddress: string
	): Promise<boolean>;
	/**
	 * Assigns a stream to a storage node.
	 */
	addStreamToStorageNode(
		streamIdOrPath: string,
		storageNodeAddress: string
	): Promise<void>;
	/**
	 * Unassigns a stream from a storage node.
	 */
	removeStreamFromStorageNode(
		streamIdOrPath: string,
		storageNodeAddress: string
	): Promise<void>;
	/**
	 * Checks whether a stream is assigned to a storage node.
	 */
	isStoredStream(
		streamIdOrPath: string,
		storageNodeAddress: string
	): Promise<boolean>;
	/**
	 * Gets all streams assigned to a storage node.
	 *
	 * @returns a list of {@link Stream} as well as `blockNumber` of result (i.e. blockchain state)
	 */
	getStoredStreams(storageNodeAddress: string): Promise<{
		streams: Stream[];
		blockNumber: number;
	}>;
	/**
	 * Gets a list of storage nodes.
	 *
	 * @param streamIdOrPath - if a stream is given, returns the list of storage nodes the stream has been assigned to;
	 * leave as `undefined` to return all storage nodes
	 */
	getStorageNodes(streamIdOrPath?: string): Promise<EthereumAddress[]>;
	/**
	 * Sets the metadata of a storage node in the storage node registry.
	 *
	 * @remarks Acts on behalf of the wallet associated with the current {@link StreamrClient} instance.
	 *
	 * @param metadata - if `undefined`, removes the storage node from the registry
	 */
	setStorageNodeMetadata(
		metadata: StorageNodeMetadata | undefined
	): Promise<void>;
	/**
	 * Gets the metadata of a storage node from the storage node registry.
	 *
	 * @returns rejects if the storage node is not found
	 */
	getStorageNodeMetadata(nodeAddress: string): Promise<StorageNodeMetadata>;
	/**
	 * Gets the Ethereum address of the wallet associated with the current {@link StreamrClient} instance.
	 */
	getAddress(): Promise<EthereumAddress>;
	/**
	 * @deprecated This in an internal method
	 */
	getNode(): Promise<NetworkNodeStub>;
	setProxies(
		streamDefinition: StreamDefinition,
		nodeIds: string[],
		direction: ProxyDirection,
		connectionCount?: number
	): Promise<void>;
	/**
	 * Used to manually initialize the network stack and connect to the network.
	 *
	 * @remarks Connecting is handled automatically by the client. Generally this method need not be called by the user.
	 */
	connect(): Promise<void>;
	_connect: () => Promise<void>;
	/**
	 * Destroys an instance of a {@link StreamrClient} by disconnecting from peers, clearing any pending tasks, and
	 * freeing up resources. This should be called once a user is done with the instance.
	 *
	 * @remarks As the name implies, the client instance (or any streams or subscriptions returned by it) should _not_
	 * be used after calling this method.
	 */
	destroy(): Promise<void>;
	_destroy: () => Promise<void>;
	/**
	 * Adds an event listener to the client.
	 * @param eventName - event name, see {@link StreamrClientEvents} for options
	 * @param listener - the callback function
	 */
	on<T extends keyof StreamrClientEvents>(
		eventName: T,
		listener: StreamrClientEvents[T]
	): void;
	/**
	 * Adds an event listener to the client that is invoked only once.
	 * @param eventName - event name, see {@link StreamrClientEvents} for options
	 * @param listener - the callback function
	 */
	once<T extends keyof StreamrClientEvents>(
		eventName: T,
		listener: StreamrClientEvents[T]
	): void;
	/**
	 * Removes an event listener from the client.
	 * @param eventName - event name, see {@link StreamrClientEvents} for options
	 * @param listener - the callback function to remove
	 */
	off<T extends keyof StreamrClientEvents>(
		eventName: T,
		listener: StreamrClientEvents[T]
	): void;
}
