import { ValueType } from '@opentelemetry/api/build/src/metrics/Metric';

import { meter } from '../globalTelemetryObjects';

const readBytes = meter.createCounter('node.db_read_bytes', {
	description: 'Total bytes read, emitted when a new message is read from DB',
	unit: 'By',
	valueType: ValueType.INT,
});

const writeBytes = meter.createCounter('node.db_write_bytes', {
	description:
		'Total bytes written, emitted when a new message is read from DB',
	unit: 'By',
	valueType: ValueType.INT,
});

const readMessages = meter.createCounter('node.db_read_messages', {
	description:
		'Total messages read, emitted when a new message is read from DB',
	unit: '1',
	valueType: ValueType.INT,
});

const writeMessages = meter.createCounter('node.db_write_messages', {
	description:
		'Total messages written, emitted when a new message is read from DB',
	unit: '1',
	valueType: ValueType.INT,
});

const httpQueries = meter.createCounter('node.http_queries', {
	description: 'Total queries received on HTTP endpoint',
	unit: '1',
	valueType: ValueType.INT,
});

const httpQueryMessages = meter.createCounter('node.http_query_messages', {
	description: 'Total messages returned from queries',
	unit: '1',
	valueType: ValueType.INT,
});

const recoveryRequests = meter.createCounter('node.recovery_requests', {
	description: 'Total recovery requests',
	unit: '1',
	valueType: ValueType.INT,
});

export const generalCounters = {
	readBytes,
	writeBytes,
	readMessages,
	writeMessages,
	httpQueries,
	recoveryRequests,
	httpQueryMessages
};
