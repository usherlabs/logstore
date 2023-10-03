import type { MessageMetricsCollector } from '@logsn/broker/dist/src/plugins/logStore/MessageMetricsCollector';
import {
	BatchObservableResult,
	ObservableCounter,
	ValueType,
} from '@opentelemetry/api';
import _ from 'lodash';

import { ctx } from '../context';
import { meter } from '../globalTelemetryObjects';

const systemMessageObservableCounters = {
	lost: meter.createObservableCounter('systemMessage.lost', {
		unit: '1',
		valueType: ValueType.INT,
		description: 'Total number of messages lost on system stream',
	}),
	bytes: meter.createObservableCounter('systemMessage.bytes', {
		unit: 'By',
		valueType: ValueType.INT,
		description: 'Total number of bytes lost on system stream messages',
	}),
	count: meter.createObservableCounter('systemMessage.count', {
		unit: '1',
		valueType: ValueType.INT,
		description: 'Total number of messages on system stream',
	}),
} satisfies {
	[key in 'bytes' | 'count' | 'lost']: ObservableCounter;
};

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
