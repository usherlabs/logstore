import { StreamMessage, StreamMessageType } from '@streamr/protocol';
import { EthereumAddress, Logger, MetricsContext } from '@streamr/utils';
import { Schema } from 'ajv';
import { Stream } from 'streamr-client';

import { formLogStoreSystemStreamId } from '../../client/utils/utils';
import { Plugin, PluginOptions } from '../../Plugin';
import { LogStoreRegistry } from '../../registry/LogStoreRegistry';
import PLUGIN_CONFIG_SCHEMA from './config.schema.json';
import { LogStore, startCassandraLogStore } from './LogStore';
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
		logStoreManagerChainAddress: EthereumAddress;
		theGraphUrl: string;
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
	private logStoreRegistry: LogStoreRegistry;
	constructor(options: PluginOptions) {
		super(options);
		this.logStoreRegistry = options.logStoreRegistry;
	}

	private cassandra?: LogStore;
	private logStoreConfig?: LogStoreConfig;
	private messageListener?: (msg: StreamMessage) => void;

	async start(): Promise<void> {
		const assignmentStream = await this.streamrClient.getStream(
			formLogStoreSystemStreamId(
				this.pluginConfig.logStoreConfig.logStoreManagerChainAddress
			)
		);
		const metricsContext = (
			await this.streamrClient!.getNode()
		).getMetricsContext();
		this.cassandra = await this.startCassandraStorage(metricsContext);

		this.logStoreConfig = await this.startLogStoreConfig(assignmentStream);
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
		systemStream: Stream
	): Promise<LogStoreConfig> {
		const node = await this.streamrClient.getNode();

		const logStoreConfig = new LogStoreConfig(
			this.pluginConfig.cluster.clusterSize,
			this.pluginConfig.cluster.myIndexInCluster,
			this.pluginConfig.logStoreConfig.refreshInterval,
			this.streamrClient,
			this.logStoreRegistry,
			{
				onStreamPartAdded: async (streamPart) => {
					try {
						await node.subscribeAndWaitForJoin(streamPart); // best-effort, can time out
					} catch (_e) {
						// no-op
					}
					try {
						await systemStream.publish({
							streamPart,
						});
						logger.debug(
							'published message to assignment stream %s',
							systemStream.id
						);
					} catch (e) {
						logger.warn(
							'failed to publish to assignment stream %s, reason: %s',
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

export const LogStorePluginConfigInjectionToken = Symbol(
	'LogStorePluginConfig'
);
