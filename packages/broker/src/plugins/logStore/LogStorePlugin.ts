import { StreamMessage, StreamMessageType } from '@streamr/protocol';
import { EthereumAddress, Logger, MetricsContext } from '@streamr/utils';
import { Schema } from 'ajv';
import { formStorageNodeAssignmentStreamId, Stream } from 'streamr-client';
import { Plugin } from '../../Plugin';
import PLUGIN_CONFIG_SCHEMA from './config.schema.json';
import { router as dataMetadataEndpoint } from './DataMetadataEndpoints';
import { router as dataQueryEndpoints } from './DataQueryEndpoints';
import { LogStore, startCassandraLogStore } from './LogStore';
import { LogStoreConfig } from './LogStoreConfig';
import { router as logStoreConfigEndpoints } from './LogStoreConfigEndpoints';

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
	private cassandra?: LogStore;
	private logStoreConfig?: LogStoreConfig;
	private messageListener?: (msg: StreamMessage) => void;

	async start(): Promise<void> {
		const clusterId =
			this.pluginConfig.cluster.clusterAddress ??
			(await this.streamrClient.getAddress());
		const assignmentStream = await this.streamrClient.getStream(
			formStorageNodeAssignmentStreamId(clusterId)
		);
		const metricsContext = (
			await this.streamrClient!.getNode()
		).getMetricsContext();
		this.cassandra = await this.startCassandraStorage(metricsContext);
		this.logStoreConfig = await this.startLogStoreConfig(
			clusterId,
			assignmentStream
		);
		this.messageListener = (msg) => {
			if (
				isStorableMessage(msg) &&
				this.logStoreConfig!.hasStreamPart(msg.getStreamPartID())
			) {
				this.cassandra!.store(msg);
			}
		};
		const node = await this.streamrClient.getNode();
		node.addMessageListener(this.messageListener);
		this.addHttpServerRouter(
			dataQueryEndpoints(this.cassandra, metricsContext)
		);
		this.addHttpServerRouter(dataMetadataEndpoint(this.cassandra));
		this.addHttpServerRouter(logStoreConfigEndpoints(this.logStoreConfig));
	}

	async stop(): Promise<void> {
		const node = await this.streamrClient.getNode();
		node.removeMessageListener(this.messageListener!);
		this.logStoreConfig!.getStreamParts().forEach((streamPart) => {
			node.unsubscribe(streamPart);
		});
		await Promise.all([
			this.cassandra!.close(),
			this.logStoreConfig!.destroy(),
		]);
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
		clusterId: EthereumAddress,
		assignmentStream: Stream
	): Promise<LogStoreConfig> {
		const node = await this.streamrClient.getNode();
		const logStoreConfig = new LogStoreConfig(
			clusterId,
			this.pluginConfig.cluster.clusterSize,
			this.pluginConfig.cluster.myIndexInCluster,
			this.pluginConfig.logStoreConfig.refreshInterval,
			this.streamrClient,
			{
				onStreamPartAdded: async (streamPart) => {
					try {
						await node.subscribeAndWaitForJoin(streamPart); // best-effort, can time out
					} catch (_e) {
						// no-op
					}
					try {
						await assignmentStream.publish({
							streamPart,
						});
						logger.debug(
							'published message to assignment stream %s',
							assignmentStream.id
						);
					} catch (e) {
						logger.warn(
							'failed to publish to assignment stream %s, reason: %s',
							assignmentStream.id,
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
