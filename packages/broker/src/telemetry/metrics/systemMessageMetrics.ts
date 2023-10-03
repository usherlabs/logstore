import { ObservableCounter } from '@opentelemetry/api';

import { meter } from '../globalTelemetryObjects';

export const systemMessageObservableCounters = {
	lost: meter.createObservableCounter('systemMessage.lost'),
	bytes: meter.createObservableCounter('systemMessage.bytes'),
	count: meter.createObservableCounter('systemMessage.count'),
} satisfies {
	[key in 'bytes' | 'count' | 'lost']: ObservableCounter;
};
