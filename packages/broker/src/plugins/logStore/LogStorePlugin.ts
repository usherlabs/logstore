import { Stream } from '@logsn/client';
import { EthereumAddress, Logger, MetricsContext } from '@streamr/utils';
import { Schema } from 'ajv';

import { Plugin, PluginOptions } from '../../Plugin';
import { BroadbandPublisher } from '../../shared/BroadbandPublisher';
import { BroadbandSubscriber } from '../../shared/BroadbandSubscriber';
import PLUGIN_CONFIG_SCHEMA from './config.schema.json';
import { logStoreContext } from './context';
import { Heartbeat } from './Heartbeat';
import { createDataQueryEndpoint } from './http/dataQueryEndpoint';
import { KyvePool } from './KyvePool';
import { LogStore, startCassandraLogStore } from './LogStore';
import { LogStoreConfig } from './LogStoreConfig';
import { MessageListener } from './MessageListener';
import { MessageMetricsCollector } from './MessageMetricsCollector';
import { MessageProcessor } from './MessageProcessor';
import { PropagationDispatcher } from './PropagationDispatcher';
import { PropagationResolver } from './PropagationResolver';
import { QueryRequestManager } from './QueryRequestManager';
import { QueryResponseManager } from './QueryResponseManager';
import { createRecoveryEndpoint } from './recoveryEndpoint';
import { ReportPoller } from './ReportPoller';
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
	programs: {
		chainRpcUrls: {
			[key: string]: string;
		};
	};
	experimental?: {
		enableValidator?: boolean;
	};
}

export class LogStorePlugin extends Plugin<LogStorePluginConfig> {
	private logStore?: LogStore;
	private logStoreConfig?: LogStoreConfig;

	private readonly systemSubscriber: BroadbandSubscriber;
	private readonly systemPublisher: BroadbandPublisher;
	private readonly heartbeatPublisher: BroadbandPublisher;
	private readonly heartbeatSubscriber: BroadbandSubscriber;
	private readonly kyvePool: KyvePool;
	private readonly messageMetricsCollector: MessageMetricsCollector;
	private readonly heartbeat: Heartbeat;
	private readonly systemCache: SystemCache;
	private readonly systemRecovery: SystemRecovery;
	private readonly queryRequestManager: QueryRequestManager;
	private readonly queryResponseManager: QueryResponseManager;
	private readonly propagationResolver: PropagationResolver;
	private readonly propagationDispatcher: PropagationDispatcher;
	private readonly reportPoller: ReportPoller;
	private readonly messageProcessor: MessageProcessor;
	private readonly messageListener: MessageListener;

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

		this.heartbeatSubscriber = new BroadbandSubscriber(
			this.logStoreClient,
			this.heartbeatStream
		);

		this.heartbeatPublisher = new BroadbandPublisher(
			this.logStoreClient,
			this.heartbeatStream
		);

		this.heartbeat = new Heartbeat(
			this.heartbeatPublisher,
			this.heartbeatSubscriber
		);

		this.messageProcessor = new MessageProcessor(
			this.pluginConfig,
			this.logStoreClient,
			this.topicsStream
		);

		this.messageListener = new MessageListener(this.logStoreClient);

		this.messageMetricsCollector = new MessageMetricsCollector(
			this.logStoreClient,
			this.systemSubscriber,
			this.recoveryStream
		);

		this.systemCache = new SystemCache(this.systemSubscriber, this.kyvePool);

		this.systemRecovery = new SystemRecovery(
			this.logStoreClient,
			this.recoveryStream,
			this.systemStream,
			this.systemCache
		);

		this.propagationResolver = new PropagationResolver(
			this.logStore!,
			this.heartbeat,
			this.systemSubscriber
		);

		this.propagationDispatcher = new PropagationDispatcher(
			this.logStore!,
			this.systemPublisher
		);

		this.queryResponseManager = new QueryResponseManager(
			this.systemPublisher,
			this.systemSubscriber,
			this.propagationResolver,
			this.propagationDispatcher
		);

		this.queryRequestManager = new QueryRequestManager(
			this.queryResponseManager,
			this.propagationResolver,
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
		const clientId = await this.logStoreClient.getAddress();

		// Context permits usage of this object in the current execution context
		// i.e. getting the queryRequestManager inside our http endpoint handlers
		logStoreContext.enterWith({
			queryRequestManager: this.queryRequestManager,
			propagationResolver: this.propagationResolver,
			clientId,
		});

		await this.heartbeat.start(clientId);
		await this.propagationResolver.start();

		if (this.pluginConfig.experimental?.enableValidator) {
			// start the report polling process
			const abortController = new AbortController();
			this.reportPoller.start(abortController.signal);
			await this.systemCache.start();
			await this.systemRecovery.start();
		}

		const metricsContext = (
			await this.logStoreClient!.getNode()
		).getMetricsContext();
		this.logStore = await this.startCassandraStorage(metricsContext);

		this.logStoreConfig = await this.startLogStoreConfig(this.systemStream);
		this.messageListener.start(
			this.logStore,
			this.logStoreConfig,
			this.messageProcessor
		);

		await this.queryRequestManager.start(this.logStore!);
		await this.queryResponseManager.start(clientId);
		await this.messageMetricsCollector.start();

		this.addHttpServerEndpoint(
			createDataQueryEndpoint(this.brokerConfig, metricsContext)
		);

		if (this.pluginConfig.experimental?.enableValidator) {
			this.addHttpServerEndpoint(
				createRecoveryEndpoint(
					this.systemStream,
					this.heartbeat,
					metricsContext
				)
			);
		}

		this.metricsTimer = setInterval(
			this.logMetrics.bind(this),
			METRICS_INTERVAL
		);
	}

	async stop(): Promise<void> {
		clearInterval(this.metricsTimer);

		const stopValidatorComponents = async () => {
			await Promise.all([this.systemCache.stop(), this.systemRecovery.stop()]);
		};

		await Promise.all([
			this.messageMetricsCollector.stop(),
			this.heartbeat.stop(),
			this.messageListener.stop(),
			this.propagationResolver.stop(),
			this.queryRequestManager.stop(),
			this.queryResponseManager.stop(),
			this.logStore!.close(),
			this.logStoreConfig!.destroy(),
			this.pluginConfig.experimental?.enableValidator
				? stopValidatorComponents()
				: Promise.resolve(),
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
