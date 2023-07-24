import {
	formLogStoreSystemStreamId,
	MessageMetadata,
	Stream,
} from '@logsn/client';
import {
	ProofOfMessageStored,
	ProofOfReport,
	QueryRequest,
	SystemMessage,
	SystemMessageType,
} from '@logsn/protocol';
import { StreamMessage, StreamMessageType } from '@streamr/protocol';
import { EthereumAddress, Logger, MetricsContext } from '@streamr/utils';
import { Schema } from 'ajv';
import { keccak256 } from 'ethers/lib/utils';

// import reportData from '../../../test/unit/plugins/logStore/data/report.json';
import { Plugin, PluginOptions } from '../../Plugin';
import { StreamPublisher } from '../../shared/StreamPublisher';
import { StreamSubscriber } from '../../shared/StreamSubscriber';
import PLUGIN_CONFIG_SCHEMA from './config.schema.json';
import { createDataQueryEndpoint } from './dataQueryEndpoint';
import { LogStore, startCassandraLogStore } from './LogStore';
import { LogStoreConfig } from './LogStoreConfig';
import { handeQueryRequest } from './messageHandlers/handeQueryRequest';
import { ReportPoller } from './ReportPoller';

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

		this.publisher = new StreamPublisher(
			this.logStoreClient,
			this.systemStream
		);
		this.subscriber = new StreamSubscriber(
			this.logStoreClient,
			this.systemStream
		);
	}

	private logStore?: LogStore;
	private logStoreConfig?: LogStoreConfig;
	private messageListener?: (msg: StreamMessage) => void;

	private readonly publisher: StreamPublisher;
	private readonly subscriber: StreamSubscriber;

	getApiAuthentication(): undefined {
		return undefined;
	}

	async start(): Promise<void> {
		const systemStream = await this.logStoreClient.getStream(
			formLogStoreSystemStreamId(
				this.brokerConfig.client.contracts!.logStoreNodeManagerChainAddress!
			)
		);

		const abortController = new AbortController();
		const poller = new ReportPoller(
			this.brokerConfig,
			this.signer,
			this.publisher
		);

		await this.subscriber.subscribe(
			async (content: unknown, metadata: MessageMetadata) => {
				const systemMessage = SystemMessage.deserialize(content);

				switch (systemMessage.messageType) {
					case SystemMessageType.QueryRequest: {
						const queryRequest = systemMessage as QueryRequest;
						logger.trace(
							'Received LogStoreQuery, content: %s metadata: %s',
							content,
							metadata
						);
						await handeQueryRequest(
							this.logStore!,
							this.logStoreClient,
							this.publisher,
							this.signer,
							logger,
							queryRequest,
							metadata
						);
						break;
					}
					case SystemMessageType.ProofOfReport: {
						const proofOfReport = systemMessage as ProofOfReport;
						await poller.processProofOfReport(proofOfReport);
						break;
					}
				}
			}
		);

		// start the report polling process
		poller.start(abortController.signal);

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

				await this.publisher.publish(proofOfMessageStored.serialize());
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
