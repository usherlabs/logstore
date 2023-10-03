// import reportData from '../../../test/unit/plugins/logStore/data/report.json';
import { KyvePool } from '@logsn/broker/dist/src/plugins/logStore/KyvePool';
import { MessageMetricsCollector } from '@logsn/broker/dist/src/plugins/logStore/MessageMetricsCollector';
import { BroadbandSubscriber } from '@logsn/broker/dist/src/shared/BroadbandSubscriber';
import { SystemMessageType } from '@logsn/protocol';

import { ObserverPluginConfig } from '../../config/config';
import { Plugin, PluginOptions } from '../../Plugin';
import { observeReportsMetrics } from '../../telemetry/metrics/reportMetrics';
import { addResponseCountIfUnique } from '../../telemetry/metrics/uniqueResponsesCounter';
import { ReportsMetricsCollector } from './ReportsMetricsCollector';
import { SystemMessagesGeneralHandler } from './SystemMessagesGeneralHandler';
import { observeMessageMetricsCollector } from "../../telemetry/metrics/systemMessageMetrics";

export class ObserverPlugin extends Plugin<ObserverPluginConfig> {
	private readonly systemSubscriber: BroadbandSubscriber;
	private readonly rollcallSubscriber: BroadbandSubscriber;
	private readonly kyvePool: KyvePool;
	private readonly messageMetricsCollector: MessageMetricsCollector;
	private stopSharingWithTelemetryCollector?: Unsubscribe;
	private systemMessagesGeneralHandler: SystemMessagesGeneralHandler;
	private reportsMetricsCollector: ReportsMetricsCollector;
	private unobserveReportsMetrics?: Unsubscribe;

	constructor(options: PluginOptions) {
		super(options);

		this.kyvePool = new KyvePool(
			this.observerConfig.pool.url,
			this.observerConfig.pool.id
		);

		this.systemSubscriber = new BroadbandSubscriber(
			this.logStoreClient,
			this.systemStream
		);

		this.rollcallSubscriber = new BroadbandSubscriber(
			this.logStoreClient,
			this.rollCallStream
		);

		this.messageMetricsCollector = new MessageMetricsCollector(
			this.logStoreClient,
			this.systemSubscriber,
			this.rollcallSubscriber,
			this.recoveryStream
		);

		this.systemMessagesGeneralHandler = new SystemMessagesGeneralHandler(
			this.systemSubscriber
		);

		this.reportsMetricsCollector = new ReportsMetricsCollector(
			this.kyvePool,
			this.observerConfig,
			this.signer,
			this.systemSubscriber
		);
	}

	getApiAuthentication(): undefined {
		return undefined;
	}

	/// Start receiving messages. Must be explicitly called.
	async start(): Promise<void> {
		await this.messageMetricsCollector.start();
		await this.systemMessagesGeneralHandler.start();
		this.reportsMetricsCollector.start();

		this.systemMessagesGeneralHandler.addHandler(
			SystemMessageType.QueryResponse,
			addResponseCountIfUnique
		);

		this.unobserveReportsMetrics = observeReportsMetrics(
			this.reportsMetricsCollector
		);

		this.stopSharingWithTelemetryCollector = observeMessageMetricsCollector(
			this.messageMetricsCollector
		);
	}

	/// Stops the subscription
	async stop(): Promise<void> {
		await Promise.all([
			this.messageMetricsCollector.stop(),
			this.stopSharingWithTelemetryCollector?.(),
			this.reportsMetricsCollector?.stop(),
			this.unobserveReportsMetrics?.(),
		]);
	}
}

type Unsubscribe = () => void;
