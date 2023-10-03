import { BatchObservableCallback, ValueType } from '@opentelemetry/api';
import { Client } from 'cassandra-driver';

import { ctx } from '../context';
import { meter } from '../globalTelemetryObjects';

const totalMessagesStored = meter.createObservableCounter(
	'cassandra_db.messages_stored',
	{
		unit: '1',
		valueType: ValueType.INT,
		description:
			'Total number of messages stored in a keyspace of the database.',
	}
);

const totalBytesStored = meter.createObservableCounter(
	'cassandra_db.bytes_stored',
	{
		unit: 'By', // Standardized unit symbol for bytes
		valueType: ValueType.INT,
		description: 'Total number of bytes stored in a keyspace of the database.',
	}
);

const numberOfBuckets = meter.createObservableCounter(
	'cassandra_db.number_of_buckets',
	{
		unit: '1',
		valueType: ValueType.INT,
		description: 'Total number of buckets used for storing messages.',
	}
);

// ====== Helpers ======

const getTotalMessagesStored = (client: Client) =>
	client
		.execute(
			`SELECT SUM(records) as count
			 FROM bucket`
		)
		.then((result) => result.rows[0].count as number);

const getTotalBytesStored = (client: Client) =>
	client
		.execute(
			`SELECT SUM(size) as count
			 FROM bucket`
		)
		.then((result) => result.rows[0].count as number);

const getNumberOfBuckets = (client: Client) =>
	client
		.execute(
			`SELECT COUNT(*) as count
			 FROM bucket`
		)
		.then((result) => Number(result.rows[0].count));

// ====== Collect directly ======
// This won't be executed unless the metrics collecting is enabled for this broker node

export const observeCassandraStorage = (client: Client) => {
	const observables = [totalMessagesStored, totalBytesStored, numberOfBuckets];
	const nodeId = ctx.nodeInfo.getStore()?.id;

	const batchCallback: BatchObservableCallback = async (observableResult) => {
		const [messages, bytes, buckets] = await Promise.all([
			getTotalMessagesStored(client),
			getTotalBytesStored(client),
			getNumberOfBuckets(client),
		]);
		observableResult.observe(totalMessagesStored, messages, {
			nodeId,
		});
		observableResult.observe(totalBytesStored, bytes, {
			nodeId,
		});
		observableResult.observe(numberOfBuckets, buckets, {
			nodeId,
		});
	};

	meter.addBatchObservableCallback(batchCallback, observables);

	return () => meter.removeBatchObservableCallback(batchCallback, observables);
};
