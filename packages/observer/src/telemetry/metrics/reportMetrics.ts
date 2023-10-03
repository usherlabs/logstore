import { BatchObservableResult, ValueType } from '@opentelemetry/api';

import { ReportsMetricsCollector } from '../../plugins/observer/ReportsMetricsCollector';
import { ctx } from '../context';
import { meter } from '../globalTelemetryObjects';

const reportTotalQueries = meter.createObservableCounter(
	'bundle.total_reported_queries',
	{
		unit: '1',
		description:
			'Total number of queries aggregated from all reports inside valid bundles',
		valueType: ValueType.INT,
	}
);

const reportStoredMessages = meter.createObservableCounter(
	'bundle.total_stored_messages',
	{
		unit: '1',
		description: 'Total number of messages stored inside valid bundles',
		valueType: ValueType.INT,
	}
);

const reportStoredBytes = meter.createObservableCounter(
	'bundle.total_stored_bytes',
	{
		unit: '1',
		description: 'Total number of bytes stored inside valid bundles',
		valueType: ValueType.INT,
	}
);

const reportTotalBytesQueried = meter.createObservableCounter(
	'bundle.total_bytes_queried',
	{
		unit: '1',
		description:
			'Total number of bytes queried from all reports inside valid bundles',
		valueType: ValueType.INT,
	}
);

const totalBundles = meter.createObservableCounter('bundle.total_bundles', {
	unit: '1',
	description: 'Total number of bundles',
	valueType: ValueType.INT,
});

export const observeReportsMetrics = (
	reportsMetricsCollector: ReportsMetricsCollector
) => {
	const observables = [
		reportTotalQueries,
		reportStoredMessages,
		reportStoredBytes,
		reportTotalBytesQueried,
		totalBundles,
	];
	const nodeId = ctx.nodeInfo.getStore()?.id;

	const batchCallback = (observableResult: BatchObservableResult) => {
		const metrics = reportsMetricsCollector.summary;
		if (!reportsMetricsCollector.isReady) {
			return;
		}
		const attributes = {
			nodeId: nodeId,
		};
		observableResult.observe(
			reportTotalQueries,
			metrics.totalQueries,
			attributes
		);
		observableResult.observe(
			reportStoredMessages,
			metrics.storedMessages,
			attributes
		);
		observableResult.observe(
			reportStoredBytes,
			metrics.storedBytes,
			attributes
		);
		observableResult.observe(
			reportTotalBytesQueried,
			metrics.totalBytesQueried,
			attributes
		);
		observableResult.observe(totalBundles, metrics.totalBundles, attributes);
	};

	meter.addBatchObservableCallback(batchCallback, observables);

	return () => meter.removeBatchObservableCallback(batchCallback, observables);
};
