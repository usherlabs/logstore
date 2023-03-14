import {
	EncryptionType,
	MessageID,
	StreamMessage,
	toStreamID,
} from '@streamr/protocol';
import { EthereumAddress, toEthereumAddress } from '@streamr/utils';
import { Client } from 'cassandra-driver';
import { randomFillSync } from 'crypto';
import toArray from 'stream-to-array';

import {
	LogStore,
	startCassandraLogStore,
} from '../../../../src/plugins/logStore/LogStore';
import { STREAMR_DOCKER_DEV_HOST } from '../../../utils';

const contactPoints = [STREAMR_DOCKER_DEV_HOST];
const localDataCenter = 'datacenter1';
const keyspace = 'logstore_dev';
const MAX_BUCKET_MESSAGE_COUNT = 20;

const publisherZero = toEthereumAddress(
	'0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
);
const publisherOne = toEthereumAddress(
	'0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
);
const publisherTwo = toEthereumAddress(
	'0xcccccccccccccccccccccccccccccccccccccccc'
);
const publisherThree = toEthereumAddress(
	'0xdddddddddddddddddddddddddddddddddddddddd'
);

export function buildMsg({
	streamId,
	streamPartition,
	timestamp,
	sequenceNumber,
	publisherId = publisherZero,
	msgChainId = '1',
	content = {},
}: {
	streamId: string;
	streamPartition: number;
	timestamp: number;
	sequenceNumber: number;
	publisherId?: EthereumAddress;
	msgChainId?: string;
	content?: any;
}): StreamMessage {
	return new StreamMessage({
		messageId: new MessageID(
			toStreamID(streamId),
			streamPartition,
			timestamp,
			sequenceNumber,
			publisherId,
			msgChainId
		),
		content: JSON.stringify(content),
		signature: 'signature',
	});
}

function buildEncryptedMsg({
	streamId,
	streamPartition,
	timestamp,
	sequenceNumber,
	publisherId = publisherZero,
	msgChainId = '1',
	content = 'ab3516983712fa4eb216a898ddd',
}: {
	streamId: string;
	streamPartition: number;
	timestamp: number;
	sequenceNumber: number;
	publisherId?: EthereumAddress;
	msgChainId?: string;
	content?: string;
}) {
	return new StreamMessage({
		messageId: new MessageID(
			toStreamID(streamId),
			streamPartition,
			timestamp,
			sequenceNumber,
			publisherId,
			msgChainId
		),
		content,
		encryptionType: EncryptionType.AES,
		signature: 'signature',
	});
}

async function storeMockMessages({
	streamId,
	streamPartition,
	minTimestamp,
	maxTimestamp,
	count,
	logSstore,
}: {
	streamId: string;
	streamPartition: number;
	minTimestamp: number;
	maxTimestamp: number;
	count: number;
	logSstore: LogStore;
}) {
	const storePromises = [];
	for (let i = 0; i < count; i++) {
		const timestamp =
			minTimestamp +
			Math.floor((i / (count - 1)) * (maxTimestamp - minTimestamp));
		const msg = buildMsg({
			streamId,
			streamPartition,
			timestamp,
			sequenceNumber: 0,
			publisherId: publisherOne,
		});
		storePromises.push(logSstore.store(msg));
	}
	return Promise.all(storePromises);
}

describe('LogStore', () => {
	let logStore: LogStore;
	let streamId: string;
	let cassandraClient: Client;
	let streamIdx = 1;

	beforeAll(async () => {
		cassandraClient = new Client({
			contactPoints,
			localDataCenter,
			keyspace,
		});
		logStore = await startCassandraLogStore({
			contactPoints,
			localDataCenter,
			keyspace,
			opts: {
				maxBucketRecords: MAX_BUCKET_MESSAGE_COUNT,
				checkFullBucketsTimeout: 100,
				storeBucketsTimeout: 100,
				bucketKeepAliveSeconds: 1,
			},
		});
	});

	afterAll(async () => {
		await Promise.allSettled([logStore?.close(), cassandraClient?.shutdown()]);
	});

	beforeEach(async () => {
		streamId = `stream-id-${Date.now()}-${streamIdx}`;
		streamIdx += 1;
	});

	test('requestFrom not throwing exception if timestamp is zero', async () => {
		const a = logStore.requestFrom(streamId, 0, 0, 0, undefined);
		const resultsA = await toArray(a);
		expect(resultsA).toEqual([]);
	});

	test('store messages into Cassandra', async () => {
		const data = {
			hello: 'world',
			value: 6,
		};
		const msg = buildMsg({
			streamId,
			streamPartition: 10,
			timestamp: 1545144750494,
			sequenceNumber: 0,
			publisherId: publisherZero,
			msgChainId: '1',
			content: data,
		});
		await logStore.store(msg);

		const result = await cassandraClient.execute(
			'SELECT * FROM stream_data WHERE stream_id = ? AND partition = 10 ALLOW FILTERING',
			[streamId]
		);

		const {
			// eslint-disable-next-line camelcase
			stream_id,
			partition,
			ts,
			sequence_no,
			publisher_id,
			msg_chain_id,
			payload,
		} = result.first();

		expect(result.first().bucket_id).not.toBeUndefined();
		expect({
			stream_id,
			partition,
			ts,
			sequence_no,
			publisher_id,
			msg_chain_id,
			payload,
		}).toEqual({
			stream_id: streamId,
			partition: 10,
			ts: new Date(1545144750494),
			sequence_no: 0,
			publisher_id: publisherZero,
			msg_chain_id: '1',
			payload: Buffer.from(msg.serialize()),
		});
	});

	test('fetch last messages', async () => {
		const msg1 = buildMsg({
			streamId,
			streamPartition: 10,
			timestamp: 3000,
			sequenceNumber: 2,
			publisherId: publisherTwo,
		});
		const msg2 = buildEncryptedMsg({
			streamId,
			streamPartition: 10,
			timestamp: 3000,
			sequenceNumber: 3,
		});
		const msg3 = buildEncryptedMsg({
			streamId,
			streamPartition: 10,
			timestamp: 4000,
			sequenceNumber: 0,
		});

		await Promise.all([
			logStore.store(
				buildEncryptedMsg({
					streamId,
					streamPartition: 10,
					timestamp: 0,
					sequenceNumber: 0,
				})
			),
			logStore.store(
				buildEncryptedMsg({
					streamId,
					streamPartition: 10,
					timestamp: 1000,
					sequenceNumber: 0,
				})
			),
			logStore.store(
				buildMsg({
					streamId,
					streamPartition: 10,
					timestamp: 2000,
					sequenceNumber: 0,
				})
			),
			logStore.store(
				buildMsg({
					streamId,
					streamPartition: 10,
					timestamp: 3000,
					sequenceNumber: 0,
				})
			),
			logStore.store(msg2),
			logStore.store(msg1),
			logStore.store(
				buildMsg({
					streamId,
					streamPartition: 10,
					timestamp: 3000,
					sequenceNumber: 1,
				})
			),
			logStore.store(msg3),
			logStore.store(
				buildEncryptedMsg({
					streamId,
					streamPartition: 666,
					timestamp: 8000,
					sequenceNumber: 0,
				})
			),
			logStore.store(
				buildMsg({
					streamId: `${streamId}-wrong`,
					streamPartition: 10,
					timestamp: 8000,
					sequenceNumber: 0,
				})
			),
		]);

		const streamingResults = logStore.requestLast(streamId, 10, 3);
		const results = await toArray(streamingResults);

		expect(results).toEqual([msg1, msg2, msg3]);
	});

	describe('fetch messages starting from a timestamp', () => {
		test('happy path', async () => {
			const msg1 = buildMsg({
				streamId,
				streamPartition: 10,
				timestamp: 3000,
				sequenceNumber: 6,
			});
			const msg2 = buildMsg({
				streamId,
				streamPartition: 10,
				timestamp: 3000,
				sequenceNumber: 7,
			});
			const msg3 = buildEncryptedMsg({
				streamId,
				streamPartition: 10,
				timestamp: 3000,
				sequenceNumber: 8,
				publisherId: publisherZero,
				msgChainId: '2',
			});
			const msg4 = buildEncryptedMsg({
				streamId,
				streamPartition: 10,
				timestamp: 3000,
				sequenceNumber: 9,
			});
			const msg5 = buildEncryptedMsg({
				streamId,
				streamPartition: 10,
				timestamp: 4000,
				sequenceNumber: 0,
			});

			await Promise.all([
				logStore.store(
					buildMsg({
						streamId,
						streamPartition: 10,
						timestamp: 0,
						sequenceNumber: 0,
					})
				),
				logStore.store(
					buildMsg({
						streamId,
						streamPartition: 10,
						timestamp: 1000,
						sequenceNumber: 0,
					})
				),
				logStore.store(
					buildEncryptedMsg({
						streamId,
						streamPartition: 10,
						timestamp: 2000,
						sequenceNumber: 0,
					})
				),
				logStore.store(
					buildMsg({
						streamId,
						streamPartition: 10,
						timestamp: 3000,
						sequenceNumber: 5,
					})
				),
				logStore.store(msg1),
				logStore.store(msg4),
				logStore.store(msg3),
				logStore.store(msg2),
				logStore.store(msg5),
				logStore.store(
					buildMsg({
						streamId,
						streamPartition: 666,
						timestamp: 8000,
						sequenceNumber: 0,
					})
				),
				logStore.store(
					buildMsg({
						streamId: `${streamId}-wrong`,
						streamPartition: 10,
						timestamp: 8000,
						sequenceNumber: 0,
					})
				),
			]);

			const streamingResults = logStore.requestFrom(
				streamId,
				10,
				3000,
				6,
				undefined
			);
			const results = await toArray(streamingResults);

			expect(results).toEqual([msg1, msg2, msg3, msg4, msg5]);
		});
	});

	describe('fetch messages within timestamp range', () => {
		test('happy path', async () => {
			const msg1 = buildMsg({
				streamId,
				streamPartition: 10,
				timestamp: 1500,
				sequenceNumber: 5,
			});
			const msg2 = buildMsg({
				streamId,
				streamPartition: 10,
				timestamp: 1500,
				sequenceNumber: 6,
			});
			const msg3 = buildEncryptedMsg({
				streamId,
				streamPartition: 10,
				timestamp: 2500,
				sequenceNumber: 1,
			});
			const msg4 = buildEncryptedMsg({
				streamId,
				streamPartition: 10,
				timestamp: 2500,
				sequenceNumber: 2,
				publisherId: publisherTwo,
			});
			const msg5 = buildEncryptedMsg({
				streamId,
				streamPartition: 10,
				timestamp: 3500,
				sequenceNumber: 4,
			});

			await Promise.all([
				logStore.store(
					buildMsg({
						streamId,
						streamPartition: 10,
						timestamp: 0,
						sequenceNumber: 0,
					})
				),
				logStore.store(
					buildEncryptedMsg({
						streamId,
						streamPartition: 10,
						timestamp: 1000,
						sequenceNumber: 0,
					})
				),
				logStore.store(
					buildEncryptedMsg({
						streamId,
						streamPartition: 10,
						timestamp: 1500,
						sequenceNumber: 4,
					})
				),
				logStore.store(msg1),
				logStore.store(msg2),
				logStore.store(msg4),
				logStore.store(msg3),
				logStore.store(msg5),
				logStore.store(
					buildEncryptedMsg({
						streamId,
						streamPartition: 666,
						timestamp: 2500,
						sequenceNumber: 0,
					})
				),
				logStore.store(
					buildEncryptedMsg({
						streamId,
						streamPartition: 10,
						timestamp: 3500,
						sequenceNumber: 5,
					})
				),
				logStore.store(
					buildMsg({
						streamId,
						streamPartition: 10,
						timestamp: 4000,
						sequenceNumber: 0,
					})
				),
				logStore.store(
					buildMsg({
						streamId: `${streamId}-wrong`,
						streamPartition: 10,
						timestamp: 3000,
						sequenceNumber: 0,
					})
				),
			]);

			const streamingResults = logStore.requestRange(
				streamId,
				10,
				1500,
				5,
				3500,
				4,
				undefined,
				undefined
			);
			const results = await toArray(streamingResults);

			expect(results).toEqual([msg1, msg2, msg3, msg4, msg5]);
		});

		test('only one message', async () => {
			const msg = buildMsg({
				streamId,
				streamPartition: 10,
				timestamp: 2000,
				sequenceNumber: 0,
			});
			await logStore.store(msg);
			const streamingResults = logStore.requestRange(
				streamId,
				10,
				1500,
				0,
				3500,
				0,
				undefined,
				undefined
			);
			const results = await toArray(streamingResults);
			expect(results).toEqual([msg]);
		});

		test('with sequenceNo, publisher and msgChainId', async () => {
			const msg1 = buildEncryptedMsg({
				streamId,
				streamPartition: 10,
				timestamp: 2000,
				sequenceNumber: 0,
				publisherId: publisherOne,
			});
			const msg2 = buildEncryptedMsg({
				streamId,
				streamPartition: 10,
				timestamp: 3000,
				sequenceNumber: 0,
				publisherId: publisherOne,
			});
			const msg3 = buildEncryptedMsg({
				streamId,
				streamPartition: 10,
				timestamp: 3000,
				sequenceNumber: 1,
				publisherId: publisherOne,
			});
			const msg4 = buildMsg({
				streamId,
				streamPartition: 10,
				timestamp: 3000,
				sequenceNumber: 2,
				publisherId: publisherOne,
			});

			await Promise.all([
				logStore.store(
					buildMsg({
						streamId,
						streamPartition: 10,
						timestamp: 0,
						sequenceNumber: 0,
						publisherId: publisherOne,
					})
				),
				logStore.store(
					buildMsg({
						streamId,
						streamPartition: 10,
						timestamp: 1500,
						sequenceNumber: 0,
						publisherId: publisherOne,
					})
				),
				logStore.store(msg1),
				logStore.store(
					buildMsg({
						streamId,
						streamPartition: 10,
						timestamp: 2500,
						sequenceNumber: 0,
						publisherId: publisherThree,
					})
				),
				logStore.store(msg2),
				logStore.store(
					buildMsg({
						streamId,
						streamPartition: 10,
						timestamp: 3000,
						sequenceNumber: 0,
						publisherId: publisherOne,
						msgChainId: '2',
					})
				),
				logStore.store(
					buildMsg({
						streamId,
						streamPartition: 10,
						timestamp: 3000,
						sequenceNumber: 3,
						publisherId: publisherOne,
					})
				),
				logStore.store(msg4),
				logStore.store(msg3),
				logStore.store(
					buildEncryptedMsg({
						streamId,
						streamPartition: 10,
						timestamp: 8000,
						sequenceNumber: 0,
						publisherId: publisherOne,
					})
				),
				logStore.store(
					buildMsg({
						streamId: `${streamId}-wrong`,
						streamPartition: 10,
						timestamp: 8000,
						sequenceNumber: 0,
						publisherId: publisherOne,
					})
				),
			]);

			const streamingResults = logStore.requestRange(
				streamId,
				10,
				1500,
				3,
				3000,
				2,
				publisherOne,
				'1'
			);
			const results = await toArray(streamingResults);

			expect(results).toEqual([msg1, msg2, msg3, msg4]);
		});
	});

	test('multiple buckets', async () => {
		const messageCount = 3 * MAX_BUCKET_MESSAGE_COUNT;
		await storeMockMessages({
			streamId,
			streamPartition: 777,
			minTimestamp: 123000000,
			maxTimestamp: 456000000,
			count: messageCount,
			logSstore: logStore,
		});

		// get all
		const streamingResults1 = logStore.requestRange(
			streamId,
			777,
			100000000,
			0,
			555000000,
			0,
			undefined,
			undefined
		);
		const results1 = await toArray(streamingResults1);
		expect(results1.length).toEqual(messageCount);

		// no messages in range (ignorable messages before range)
		const streamingResults2 = logStore.requestRange(
			streamId,
			777,
			460000000,
			0,
			470000000,
			0,
			undefined,
			undefined
		);
		const results2 = await toArray(streamingResults2);
		expect(results2).toEqual([]);

		// no messages in range (ignorable messages after range)
		const streamingResults3 = logStore.requestRange(
			streamId,
			777,
			100000000,
			0,
			110000000,
			0,
			undefined,
			undefined
		);
		const results3 = await toArray(streamingResults3);
		expect(results3).toEqual([]);
	}, 20000);

	// This test proves that NET-350 is still an issue
	describe.skip('messages pushed in randomized order', () => {
		const NUM_MESSAGES = 100;
		const MESSAGE_SIZE = 1000;

		let beforeEachWasRunAlready = false;
		beforeEach(async () => {
			if (beforeEachWasRunAlready) {
				return;
			}
			beforeEachWasRunAlready = true;
			const messages = [];
			const randomBuffer = Buffer.alloc(MESSAGE_SIZE);
			for (let i = 0; i < NUM_MESSAGES; i++) {
				randomFillSync(randomBuffer);
				const msg = buildMsg({
					streamId,
					streamPartition: 0,
					timestamp: (i + 1) * 1000,
					sequenceNumber: i,
					publisherId: publisherOne,
					content: randomBuffer.toString('hex'),
				});
				messages.push(msg);
			}
			const storePromises = [];
			for (const msg of messages.sort(() => 0.5 - Math.random())) {
				// biased, "semi-random" shuffle
				storePromises.push(logStore.store(msg));
			}
			const firstQuarter = Math.floor(storePromises.length * (1 / 4));
			const halfPoint = Math.floor(storePromises.length * (2 / 4));
			const lastQuarter = Math.floor(storePromises.length * (3 / 4));
			await Promise.all(storePromises.slice(0, firstQuarter));
			await Promise.all(storePromises.slice(firstQuarter, halfPoint));
			await Promise.all(storePromises.slice(halfPoint, lastQuarter));
			await Promise.all(storePromises.slice(lastQuarter));
		}, 30 * 1000);

		it('requestLast correctly returns last 10 messages', async () => {
			const streamingResults = logStore.requestLast(streamId, 0, 10);
			const results = await toArray(streamingResults);
			expect(results.map((msg) => msg.messageId.sequenceNumber)).toEqual([
				90, 91, 92, 93, 94, 95, 96, 97, 98, 99,
			]);
		});

		it('requestFrom correctly returns messages', async () => {
			const streamingResults = logStore.requestFrom(streamId, 0, 91000, 0);
			const results = await toArray(streamingResults);
			expect(results.map((msg) => msg.messageId.sequenceNumber)).toEqual([
				90, 91, 92, 93, 94, 95, 96, 97, 98, 99,
			]);
		});

		it('requestRange correctly returns range of messages', async () => {
			const streamingResults = logStore.requestRange(
				streamId,
				0,
				41000,
				0,
				50000,
				0,
				undefined,
				undefined
			);
			const results = await toArray(streamingResults);
			expect(results.map((msg) => msg.messageId.sequenceNumber)).toEqual([
				40, 41, 42, 43, 44, 45, 46, 47, 48, 49,
			]);
		});
	});

	describe('stream details', () => {
		let streamId: string;
		beforeAll(async () => {
			streamId = `stream-id-details-${Date.now()}-${streamIdx}`;
			const msg1 = buildMsg({
				streamId,
				streamPartition: 10,
				timestamp: 2000,
				sequenceNumber: 3,
			});
			const msg2 = buildMsg({
				streamId,
				streamPartition: 10,
				timestamp: 3000,
				sequenceNumber: 2,
				publisherId: publisherTwo,
			});
			const msg3 = buildMsg({
				streamId,
				streamPartition: 10,
				timestamp: 4000,
				sequenceNumber: 0,
			});
			await logStore.store(msg1);
			await logStore.store(msg2);
			await logStore.store(msg3);
		});

		test('getFirstMessageInStream', async () => {
			const ts = await logStore.getFirstMessageTimestampInStream(streamId, 10);
			expect(ts).toEqual(2000);
		});

		test('getLastMessageTimestampInStream', async () => {
			const ts = await logStore.getLastMessageTimestampInStream(streamId, 10);
			expect(ts).toEqual(4000);
		});

		test('getNumberOfMessagesInStream', async () => {
			const count = await logStore.getNumberOfMessagesInStream(streamId, 10);
			expect(count).toEqual(3);
		});

		test('getTotalBytesInStream', async () => {
			const bytes = await logStore.getTotalBytesInStream(streamId, 10);
			expect(bytes).toBeGreaterThan(0);
		});
	});
});
