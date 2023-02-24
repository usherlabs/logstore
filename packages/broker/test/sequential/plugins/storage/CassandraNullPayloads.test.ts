import { MessageID, StreamMessage, toStreamID } from '@streamr/protocol';
import { randomEthereumAddress } from '@streamr/test-utils';
import { toEthereumAddress } from '@streamr/utils';
import { types as cassandraTypes, Client } from 'cassandra-driver';
import toArray from 'stream-to-array';

import { BucketId } from '../../../../src/plugins/logStore/Bucket';
import {
	LogStore,
	startCassandraLogStore,
} from '../../../../src/plugins/logStore/LogStore';
import { STREAMR_DOCKER_DEV_HOST } from '../../../utils';

jest.setTimeout(30000);

const { TimeUuid } = cassandraTypes;

const contactPoints = [STREAMR_DOCKER_DEV_HOST];
const localDataCenter = 'datacenter1';
const keyspace = 'logstore_dev';

const insertBucket = async (cassandraClient: Client, streamId: string) => {
	const dateCreate = Date.now();
	const bucketId = TimeUuid.fromDate(new Date(dateCreate)).toString();
	const query =
		'INSERT INTO bucket (stream_id, partition, date_create, id, records, size)' +
		'VALUES (?, 0, ?, ?, 1, 1)';
	await cassandraClient.execute(query, [streamId, dateCreate, bucketId], {
		prepare: true,
	});
	return bucketId;
};

const insertNullData = async (
	cassandraClient: Client,
	streamId: string,
	bucketId: BucketId
) => {
	const insert =
		'INSERT INTO stream_data ' +
		'(stream_id, partition, bucket_id, ts, sequence_no, publisher_id, msg_chain_id, payload) ' +
		'VALUES (?, 0, ?, ?, 0, ?, ?, ?)';
	await cassandraClient.execute(
		insert,
		[streamId, bucketId, new Date(), '', '', null],
		{
			prepare: true,
		}
	);
};

async function storeMockMessages({
	streamId,
	count,
	logStore,
}: {
	streamId: string;
	count: number;
	logStore: LogStore;
}) {
	const storePromises = [];
	for (let i = 0; i < count; i++) {
		const timestamp = Math.floor((i / (count - 1)) * 1e10);
		const msg = new StreamMessage({
			messageId: new MessageID(
				toStreamID(streamId),
				0,
				timestamp,
				0,
				toEthereumAddress('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
				''
			),
			content: JSON.stringify({}),
			signature: 'signature',
		});
		storePromises.push(logStore.store(msg));
	}
	return Promise.all(storePromises);
}

describe('CassandraNullPayloads', () => {
	let cassandraClient: Client;
	let logStore: LogStore;

	beforeAll(() => {
		cassandraClient = new Client({
			contactPoints,
			localDataCenter,
			keyspace,
		});
	});

	afterAll(() => {
		cassandraClient.shutdown();
	});

	beforeEach(async () => {
		logStore = await startCassandraLogStore({
			contactPoints,
			localDataCenter,
			keyspace,
			opts: {
				checkFullBucketsTimeout: 100,
				storeBucketsTimeout: 100,
				bucketKeepAliveSeconds: 1,
			},
		});
	});

	afterEach(async () => {
		await logStore.close();
	});

	test('insert a null payload and retrieve n-1 messages (null not included in return set)', async () => {
		const HEALTHY_MESSAGE_COUNT = 9;
		const streamId = toStreamID(
			'/CassandraNullPayloads',
			randomEthereumAddress()
		);

		const bucketId = await insertBucket(cassandraClient, streamId);

		await insertNullData(cassandraClient, streamId, bucketId);
		await storeMockMessages({
			streamId,
			count: HEALTHY_MESSAGE_COUNT,
			logStore: logStore,
		});

		const streamingResults = logStore.requestLast(
			streamId,
			0,
			HEALTHY_MESSAGE_COUNT + 1
		);
		const messages = await toArray(streamingResults);
		expect(messages.length).toEqual(HEALTHY_MESSAGE_COUNT);
	});
});
