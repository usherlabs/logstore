import { KyvePool } from '@logsn/broker/dist/src/plugins/logStore/KyvePool';
import { ReportPoller } from '@logsn/broker/dist/src/plugins/logStore/ReportPoller';
import { BroadbandSubscriber } from '@logsn/broker/dist/src/shared/BroadbandSubscriber';
import { IReportV1 } from '@logsn/protocol';
import { Logger } from '@streamr/utils';
import { Signer } from 'ethers';
import { Promise } from 'ts-toolbelt/out/Any/Promise';

import { StrictConfig } from '../../config/config';
import { moduleFromMetaUrl } from '../../utils/moduleFromMetaUrl';

const logger = new Logger(moduleFromMetaUrl(import.meta?.url));

export class ReportsMetricsCollector extends ReportPoller {
	private reportsAggregation = {
		storedMessages: 0,
		storedBytes: 0,
		totalQueries: 0,
		totalBytesQueried: 0,
		// totalMessagesQueried: 0,
		totalBundles: 0,
	};
	private latestProcessedBundle: number = 0;
	/**
	 *  Indicates if the summary is ready to be used. Necessary to prevent early access, and reports less than
	 *  the latest bundle indicates.
	 */
	private allBundlesProcessed = false;
	private pollTimer: NodeJS.Timer | null = null;

	constructor(
		kyvePool: KyvePool,
		private config: Pick<StrictConfig, 'pool'>,
		signer: Signer,
		subscriber: BroadbandSubscriber
	) {
		super(kyvePool, config, signer, {} as any, subscriber);
	}

	/// Start collecting metrics. Must be explicitly called.
	override async start(): Promise<void> {
		logger.info('Starting reports metrics collector');

		// do once and then start polling
		this.fetchAndUpdateLatestReports();
		this.pollTimer = setInterval(() => {
			this.fetchAndUpdateLatestReports();
		}, this.config.pool.pollInterval);
	}

	/// Clear the timers, cleanups
	public stop() {
		if (this.pollTimer) {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
		}
	}

	/**
	 * Fetches and updates the latest reports from the pool.
	 */
	private async fetchAndUpdateLatestReports() {
		const { totalBundles } = await this.kyvePool.fetchPoolData();
		const latestAvailableBundle = totalBundles - 1;
		logger.debug(
			`Updating reports data. Latest bundle: ${latestAvailableBundle}`
		);
		if (latestAvailableBundle <= this.latestProcessedBundle) {
			return;
		}

		await this.processBundlesUntilLatest(latestAvailableBundle);
		this.allBundlesProcessed = true;
	}

	/**
	 * Processes specified bundles starting from the first unprocessed one.
	 * @param latestAvailableBundle - The latest bundle to process.
	 */
	private async processBundlesUntilLatest(latestAvailableBundle: number) {
		const firstUnprocessedBundle = this.latestProcessedBundle + 1;
		for (let i = firstUnprocessedBundle; i <= latestAvailableBundle; ++i) {
			logger.debug(`Fetching report data for bundle ${i}`);
			const report = await super.fetchReportData(i);
			this.aggregateReport(report.deserialize() as IReportV1);
			this.latestProcessedBundle = i;
		}
	}

	public get summary() {
		return this.reportsAggregation;
	}

	public get isReady() {
		return this.allBundlesProcessed;
	}

	/**
	 * Aggregates the report data into the summary.
	 */
	private aggregateReport(report: IReportV1) {
		const { events } = report;
		const queries = events?.queries ?? [];
		const queriesCountIncrease = queries.length;
		const queriesByteIncrease = queries.reduce(
			(prev, q) => (q.size ?? 0) + prev,
			0
		);

		const storageEvents = events?.storage ?? [];
		const storeCountIncrease = storageEvents.length;
		const storeByteIncrease = storageEvents.reduce(
			(prev, q) => (q.size ?? 0) + prev,
			0
		);

		logger.info(
			`Aggregating report data. Bundle: ${report.id}. Queries: ${queriesCountIncrease}. Storage: ${storeCountIncrease}`
		);

		this.reportsAggregation.storedMessages += storeCountIncrease;
		this.reportsAggregation.storedBytes += storeByteIncrease;
		this.reportsAggregation.totalQueries += queriesCountIncrease;
		this.reportsAggregation.totalBytesQueried += queriesByteIncrease;
		// this.reportsAggregation.totalMessagesQueried += queriesCountIncrease;
		this.reportsAggregation.totalBundles += 1;
	}
}
