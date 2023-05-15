import { formLogStoreSystemStreamId } from '@concertodao/logstore-client';
import {
	ProofOfMessageStored,
	QueryFromOptions,
	QueryLastOptions,
	QueryRangeOptions,
	QueryRequest,
	QueryResponse,
	QueryType,
	SystemMessage,
	SystemMessageType,
} from '@concertodao/logstore-protocol';
import { Stream } from '@concertodao/streamr-client';
import { StreamMessage, StreamMessageType } from '@streamr/protocol';
import { EthereumAddress, Logger, MetricsContext } from '@streamr/utils';
import { Schema } from 'ajv';
import { keccak256 } from 'ethers/lib/utils';
import { Readable } from 'stream';

import { Plugin, PluginOptions } from '../../Plugin';
import PLUGIN_CONFIG_SCHEMA from './config.schema.json';
import { hashResponse } from './Consensus';
import { createDataQueryEndpoint } from './dataQueryEndpoint';
import {
	LogStore,
	MAX_SEQUENCE_NUMBER_VALUE,
	MIN_SEQUENCE_NUMBER_VALUE,
	startCassandraLogStore,
} from './LogStore';
import { LogStoreConfig } from './LogStoreConfig';

const logger = new Logger(module);

export interface LogStorePluginConfig {
	cassandra: {
		hosts: string[];
		username: string;
		password: string;
		keyspace: string;
		datacenter: string;
	};
	logStoreConfig: {
		refreshInterval: number;
	};
	// TODO: Do we need the cluster config for LogStore
	cluster: {
		// If clusterAddress is undefined, the broker's address will be used
		clusterAddress?: EthereumAddress;
		clusterSize: number;
		myIndexInCluster: number;
	};
}

const isStorableMessage = (msg: StreamMessage): boolean => {
	return msg.messageType === StreamMessageType.MESSAGE;
};

export class LogStorePlugin extends Plugin<LogStorePluginConfig> {
	constructor(options: PluginOptions) {
		super(options);
	}

	private logStore?: LogStore;
	private logStoreConfig?: LogStoreConfig;
	private messageListener?: (msg: StreamMessage) => void;

	getApiAuthentication(): undefined {
		return undefined;
	}

	async start(): Promise<void> {
		const systemStream = await this.logStoreClient.getStream(
			formLogStoreSystemStreamId(
				this.brokerConfig.client.contracts!.logStoreNodeManagerChainAddress!
			)
		);

		await this.logStoreClient.subscribe(
			systemStream,
			async (content, metadata) => {
				// Do not process own messages
				if (metadata.publisherId === (await this.logStoreClient.getAddress())) {
					return;
				}

				logger.trace(
					'Received LogStoreQuery, content: %s metadata: %s',
					content,
					metadata
				);

				const queryMessage = SystemMessage.deserialize(content);
				if (queryMessage.messageType === SystemMessageType.QueryRequest) {
					const queryRequest = queryMessage as QueryRequest;
					logger.trace('Deserialized queryRequest: %s', queryRequest);

					let readableStream: Readable;
					switch (queryRequest.queryType) {
						case QueryType.Last: {
							const { last } = queryRequest.queryOptions as QueryLastOptions;

							readableStream = this.logStore!.requestLast(
								queryRequest.streamId,
								queryRequest.partition,
								last
							);
							break;
						}
						case QueryType.From: {
							const { from, publisherId } =
								queryRequest.queryOptions as QueryFromOptions;

							readableStream = this.logStore!.requestFrom(
								queryRequest.streamId,
								queryRequest.partition,
								from.timestamp,
								from.sequenceNumber || MIN_SEQUENCE_NUMBER_VALUE,
								publisherId
							);
							break;
						}
						case QueryType.Range: {
							const { from, publisherId, to, msgChainId } =
								queryRequest.queryOptions as QueryRangeOptions;

							readableStream = this.logStore!.requestRange(
								queryRequest.streamId,
								queryRequest.partition,
								from.timestamp,
								from.sequenceNumber || MIN_SEQUENCE_NUMBER_VALUE,
								to.timestamp,
								to.sequenceNumber || MAX_SEQUENCE_NUMBER_VALUE,
								publisherId,
								msgChainId
							);
							break;
						}
						default:
							throw new Error('Unknown QueryType');
					}

					const { size, hash } = await hashResponse(
						queryRequest.requestId,
						readableStream
					);

					const queryResponse = new QueryResponse({
						requestId: queryRequest.requestId,
						size,
						hash,
						signature: await this.signer.signMessage(hash),
					});
					await this.logStoreClient.publish(
						systemStream,
						queryResponse.serialize()
					);
				}
			}
		);

		const metricsContext = (
			await this.logStoreClient!.getNode()
		).getMetricsContext();
		this.logStore = await this.startCassandraStorage(metricsContext);

		this.logStoreConfig = await this.startLogStoreConfig(systemStream);
		this.messageListener = async (msg) => {
			if (
				isStorableMessage(msg) &&
				this.logStoreConfig!.hasStreamPart(msg.getStreamPartID())
			) {
				await this.logStore!.store(msg);

				const size = Buffer.byteLength(msg.serialize());
				const hash = keccak256(
					Uint8Array.from(Buffer.from(msg.serialize() + size))
				);

				const proofOfMessageStored = new ProofOfMessageStored({
					streamId: msg.getStreamId(),
					partition: msg.getStreamPartition(),
					timestamp: msg.getTimestamp(),
					sequenceNumber: msg.getSequenceNumber(),
					size,
					hash,
				});

				await this.logStoreClient.publish(
					systemStream,
					proofOfMessageStored.serialize()
				);
			}
		};
		const node = await this.logStoreClient.getNode();
		node.addMessageListener(this.messageListener);
		this.addHttpServerEndpoint(
			createDataQueryEndpoint(
				this.brokerConfig,
				this.logStore,
				this.logStoreClient,
				this.signer,
				systemStream,
				metricsContext
			)
		);
	}

	async stop(): Promise<void> {
		const node = await this.logStoreClient.getNode();
		node.removeMessageListener(this.messageListener!);
		this.logStoreConfig!.getStreamParts().forEach((streamPart) => {
			node.unsubscribe(streamPart);
		});
		await Promise.all([this.logStore!.close(), this.logStoreConfig!.destroy()]);
	}

	// eslint-disable-next-line class-methods-use-this
	override getConfigSchema(): Schema {
		return PLUGIN_CONFIG_SCHEMA;
	}

	private async startCassandraStorage(
		metricsContext: MetricsContext
	): Promise<LogStore> {
		const cassandraStorage = await startCassandraLogStore({
			contactPoints: [...this.pluginConfig.cassandra.hosts],
			localDataCenter: this.pluginConfig.cassandra.datacenter,
			keyspace: this.pluginConfig.cassandra.keyspace,
			username: this.pluginConfig.cassandra.username,
			password: this.pluginConfig.cassandra.password,
			opts: {
				useTtl: false,
			},
		});
		cassandraStorage.enableMetrics(metricsContext);
		return cassandraStorage;
	}

	private async startLogStoreConfig(
		systemStream: Stream
	): Promise<LogStoreConfig> {
		const node = await this.logStoreClient.getNode();

		const logStoreConfig = new LogStoreConfig(
			this.pluginConfig.cluster.clusterSize,
			this.pluginConfig.cluster.myIndexInCluster,
			this.pluginConfig.logStoreConfig.refreshInterval,
			this.logStoreClient,
			{
				onStreamPartAdded: async (streamPart) => {
					try {
						await node.subscribeAndWaitForJoin(streamPart); // best-effort, can time out
					} catch (_e) {
						// no-op
					}
					try {
						// TODO: Temporary disabled sending of assignment messages through the system stream.
						// Originally, it has been sending the message to the `assignments` stream as a plaing `streamPart` sting,
						// which then has been listened by waitForAssignmentsToPropagate func on the client.
						// Need to get back to it later!!!
						// await systemStream.publish({
						// 	streamPart,
						// });
						logger.debug(
							'published Assignment message to system stream %s',
							systemStream.id
						);
					} catch (e) {
						logger.warn(
							'failed to publish to system stream %s, reason: %s',
							systemStream.id,
							e
						);
					}
				},
				onStreamPartRemoved: (streamPart) => {
					node.unsubscribe(streamPart);
				},
			}
		);
		await logStoreConfig.start();
		return logStoreConfig;
	}
}
