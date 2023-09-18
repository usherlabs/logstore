import { Stream } from '@logsn/client';
import { EthereumAddress, Logger, MetricsContext } from '@streamr/utils';
import { Schema } from 'ajv';

// import reportData from '../../../test/unit/plugins/logStore/data/report.json';
import { Plugin, PluginOptions } from '../../Plugin';
import { BroadbandPublisher } from '../../shared/BroadbandPublisher';
import { BroadbandSubscriber } from '../../shared/BroadbandSubscriber';
import PLUGIN_CONFIG_SCHEMA from './config.schema.json';
import { ConsensusManager } from './ConsensusManger';
import { createDataQueryEndpoint } from './http/dataQueryEndpoint';
import { KyvePool } from './KyvePool';
import { LogStore, startCassandraLogStore } from './LogStore';
import { LogStoreConfig } from './LogStoreConfig';
import { MessageListener } from './MessageListener';
import { MessageMetricsCollector } from './MessageMetricsCollector';
import { QueryRequestHandler } from './QueryRequestHandler';
import { createRecoveryEndpoint } from './recoveryEndpoint';
import { ReportPoller } from './ReportPoller';
import { RollCall } from './RollCall';
import { SystemCache } from './SystemCache';
import { SystemRecovery } from './SystemRecovery';

const METRICS_INTERVAL = 60 * 1000;

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

export class LogStorePlugin extends Plugin<LogStorePluginConfig> {
	private logStore?: LogStore;
	private logStoreConfig?: LogStoreConfig;

	private readonly systemSubscriber: BroadbandSubscriber;
	private readonly systemPublisher: BroadbandPublisher;
	private readonly rollcallSubscriber: BroadbandSubscriber;
	private readonly rollcallPublisher: BroadbandPublisher;
	private readonly kyvePool: KyvePool;
	private readonly messageMetricsCollector: MessageMetricsCollector;
	private readonly rollCall: RollCall;
	private readonly systemCache: SystemCache;
	private readonly systemRecovery: SystemRecovery;
	private readonly consensusManager: ConsensusManager;
	private readonly queryRequestHandler: QueryRequestHandler;
	private readonly reportPoller: ReportPoller;
	private readonly messageListener: MessageListener;

	private seqNum: number = 0;

	private metricsTimer?: NodeJS.Timer;

	constructor(options: PluginOptions) {
		super(options);

		this.systemPublisher = new BroadbandPublisher(
			this.logStoreClient,
			this.systemStream
		);

		this.systemSubscriber = new BroadbandSubscriber(
			this.logStoreClient,
			this.systemStream
		);

		this.kyvePool = new KyvePool(
			this.brokerConfig.pool.url,
			this.brokerConfig.pool.id
		);

		this.rollcallPublisher = new BroadbandPublisher(
			this.logStoreClient,
			this.rollCallStream
		);

		this.rollcallSubscriber = new BroadbandSubscriber(
			this.logStoreClient,
			this.rollCallStream
		);

		this.messageListener = new MessageListener(
			this.logStoreClient,
			this.systemSubscriber,
			this.systemPublisher,
			this.nodeManger
		);

		this.messageMetricsCollector = new MessageMetricsCollector(
			this.logStoreClient,
			this.systemSubscriber,
			this.rollcallSubscriber,
			this.recoveryStream
		);

		this.rollCall = new RollCall(
			this.rollcallPublisher,
			this.rollcallSubscriber
		);

		this.systemCache = new SystemCache(this.systemSubscriber, this.kyvePool);

		this.systemRecovery = new SystemRecovery(
			this.logStoreClient,
			this.recoveryStream,
			this.systemStream,
			this.systemCache
		);

		this.queryRequestHandler = new QueryRequestHandler(
			this.systemPublisher,
			this.systemSubscriber,
			this.signer
		);

		this.consensusManager = new ConsensusManager(
			this.nodeManger,
			this.systemPublisher,
			this.systemSubscriber
		);

		this.reportPoller = new ReportPoller(
			this.kyvePool,
			this.brokerConfig,
			this.signer,
			this.systemPublisher,
			this.systemSubscriber
		);
	}

	getApiAuthentication(): undefined {
		return undefined;
	}

	async start(): Promise<void> {
		await this.rollCall.start();
		await this.systemCache.start();
		await this.systemRecovery.start();
		await this.consensusManager.start();

		const abortController = new AbortController();
		// start the report polling process
		this.reportPoller.start(abortController.signal);

		const metricsContext = (
			await this.logStoreClient!.getNode()
		).getMetricsContext();
		this.logStore = await this.startCassandraStorage(metricsContext);

		this.logStoreConfig = await this.startLogStoreConfig(this.systemStream);
		this.messageListener.start(this.logStore, this.logStoreConfig);

		await this.queryRequestHandler.start(this.logStore!);
		await this.messageMetricsCollector.start();

		this.addHttpServerEndpoint(
			createDataQueryEndpoint(
				this.brokerConfig,
				this.logStore,
				this.consensusManager,
				metricsContext
			)
		);
		this.addHttpServerEndpoint(
			createRecoveryEndpoint(this.systemStream, this.rollCall, metricsContext)
		);

		this.metricsTimer = setInterval(
			this.logMetrics.bind(this),
			METRICS_INTERVAL
		);
	}

	async stop(): Promise<void> {
		clearInterval(this.metricsTimer);

		await Promise.all([
			this.messageMetricsCollector.stop(),
			this.messageListener.stop(),
			this.consensusManager.stop(),
			this.queryRequestHandler.stop(),
			this.rollCall.stop(),
			this.systemCache.stop(),
			this.systemRecovery.stop(),
			this.logStore!.close(),
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

	private logMetrics() {
		logger.info(
			`Metrics ${JSON.stringify(this.messageMetricsCollector.summary)}`
		);
	}
}
