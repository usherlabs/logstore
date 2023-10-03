import { BatchObservableResult } from '@opentelemetry/api';
import _ from 'lodash';

import type { MessageMetricsCollector } from '../../plugins/logStore/MessageMetricsCollector';
import { ctx } from '../context';
import { meter } from '../globalTelemetryObjects';
import { systemMessageObservableCounters } from './systemMessageMetrics';

/**
 * Message Metrics Collector is a class designed to help us collect metrics
 * from the system messages that are sent and received by the broker.
 *
 * We're using the OpenTelemetry BatchObservableResult to collect metrics from this
 * same class, to reuse the same code.
 *
 * @param collector
 */
export const observeMessageMetricsCollector = (
	collector: MessageMetricsCollector
) => {
	const { bytes, count, lost } = systemMessageObservableCounters;
	const observables = [bytes, count, lost];
	const nodeId = ctx.nodeInfo.getStore()?.id;

	const batchCallback = (observableResult: BatchObservableResult) => {
		const metrics = _.compact(collector.summary);

		for (const metric of metrics) {
			const attributes = {
				nodeId,
				subject: metric.subject,
			};
			observableResult.observe(bytes, metric?.bytes, attributes);
			observableResult.observe(count, metric?.count, attributes);
			observableResult.observe(lost, metric?.lost, attributes);
		}
	};
	meter.addBatchObservableCallback(batchCallback, observables);

	return () => meter.removeBatchObservableCallback(batchCallback, observables);
};
