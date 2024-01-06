import { MessageID, StreamMessage, toStreamID } from '@streamr/protocol';
import { waitForStreamToEnd } from '@streamr/test-utils';
import {
	toEthereumAddress,
	waitForCondition,
	waitForEvent,
} from '@streamr/utils';
import { Client } from 'cassandra-driver';
import { PassThrough, Readable } from 'stream';

import {
	LogStore,
	startCassandraLogStore,
} from '../../../../src/plugins/logStore/LogStore';
import { STREAMR_DOCKER_DEV_HOST } from '../../../utils';

const contactPoints = [STREAMR_DOCKER_DEV_HOST];
const localDataCenter = 'datacenter1';
const keyspace = 'logstore_dev';

const MOCK_STREAM_ID = 'mock-stream-id-' + Date.now();
const MOCK_PUBLISHER_ID = toEthereumAddress(
	'0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
);
const MOCK_MSG_CHAIN_ID = 'msgChainId';
const createMockMessage = (i: number) => {
	return new StreamMessage({
		messageId: new MessageID(
			toStreamID(MOCK_STREAM_ID),
			0,
			i,
			0,
			MOCK_PUBLISHER_ID,
			MOCK_MSG_CHAIN_ID
		),
		content: {
			value: i,
		},
		signature: 'signature',
	});
};
const MOCK_MESSAGES = [1, 2, 3].map((contentValue: number) =>
	createMockMessage(contentValue)
);

const EMPTY_STREAM_ID = 'empty-stream-id' + Date.now();

const REQUEST_TYPE_FROM = 'requestFrom';
const REQUEST_TYPE_RANGE = 'requestRange';

const streamToContentValues = async (resultStream: Readable) => {
	const messages: StreamMessage<{ value: any }>[] = (await waitForStreamToEnd(
		resultStream
	)) as StreamMessage<{ value: any }>[];
	return messages.map((message) => message.getParsedContent().value);
};

class ProxyClient {
	static ERROR = new Error('mock-error');

	private realClient: Client;
	private errorQueryId: string | undefined;

	constructor(realClient: Client) {
		this.realClient = realClient;
	}

	eachRow(
		query: string,
		params: any,
		options: any,
		rowCallback: any,
		resultCallback?: (err: Error | undefined, result: any) => void
	) {
		if (this.hasError(query)) {
			resultCallback!(ProxyClient.ERROR, undefined);
		} else {
			return this.realClient.eachRow(
				query,
				params,
				options,
				rowCallback,
				resultCallback
			);
		}
	}

	execute(query: string, params: any, options: any) {
		if (this.hasError(query)) {
			return Promise.reject(ProxyClient.ERROR);
		} else {
			return this.realClient.execute(query, params, options);
		}
	}

	stream(query: string, params: any, options: any, callback: any) {
		if (this.hasError(query)) {
			const stream = new PassThrough({
				objectMode: true,
			});
			stream.destroy(ProxyClient.ERROR);
			return stream;
		} else {
			return this.realClient.stream(query, params, options, callback);
		}
	}

	shutdown(): Promise<void> {
		return this.realClient.shutdown();
	}

	setError(queryId: string) {
		this.errorQueryId = queryId;
	}

	private hasError(query: string): boolean {
		return this.errorQueryId !== undefined && query.includes(this.errorQueryId);
	}
}

describe('cassanda-queries', () => {
	let logStore: LogStore;
	let realClient: Client;

	const waitForStoredMessageCount = async (expectedCount: number) => {
		return waitForCondition(async () => {
			const result = await realClient.execute(
				'SELECT COUNT(*) AS total FROM stream_data WHERE stream_id = ? ALLOW FILTERING',
				[MOCK_STREAM_ID]
			);
			const actualCount = result.rows[0].total.low;
			return actualCount === expectedCount;
		});
	};

	beforeAll(async () => {
		logStore = await startCassandraLogStore({
			contactPoints,
			localDataCenter,
			keyspace,
			opts: {
				checkFullBucketsTimeout: 100,
				storeBucketsTimeout: 100,
				bucketKeepAliveSeconds: 5,
			},
		});
		realClient = logStore.cassandraClient;
		await Promise.all(MOCK_MESSAGES.map((msg) => logStore.store(msg)));
		await waitForStoredMessageCount(MOCK_MESSAGES.length);
	});

	afterAll(async () => {
		await logStore?.close(); // also cleans up realClient
	});

	beforeEach(async () => {
		const proxyClient = new ProxyClient(realClient) as any;
		logStore.cassandraClient = proxyClient;
		logStore.bucketManager.cassandraClient = proxyClient;
	});

	describe('requestByMessageId', () => {
		it('single happy path', async () => {
			const resultStream = logStore.requestByMessageId(
				MOCK_MESSAGES[0].messageId.serialize()
			);
			const contentValues = await streamToContentValues(resultStream);
			expect(contentValues).toEqual([1]);
		});

		it('multiple happy path', async () => {
			const resultStream = logStore.requestByMessageIds(
				MOCK_MESSAGES.map((msg) => msg.messageId.serialize())
			);
			const contentValues = await streamToContentValues(resultStream);
			expect(contentValues).toEqual([1, 2, 3]);
		});

		it('multiple happy path received in same order', async () => {
			const resultStream = logStore.requestByMessageIds(
				[2, 1, 3].map((i) => MOCK_MESSAGES[i - 1].messageId.serialize())
			);
			const contentValues = await streamToContentValues(resultStream);
			expect(contentValues).toEqual([2, 1, 3]);
		});

		// Set to skip temporarily while it does not create a new bucket
		// but breaks all the other tests because of storing extra messages
		// whose are not expected by the other tests
		it.skip('multiple with more than one bucket', async () => {
			const MOCK_MESSAGES_2 = [4, 5, 6].map((contentValue: number) =>
				createMockMessage(contentValue)
			);
			await Promise.all(MOCK_MESSAGES_2.map((msg) => logStore.store(msg)));
			await waitForStoredMessageCount(
				MOCK_MESSAGES.length + MOCK_MESSAGES_2.length
			);

			const resultStream = logStore.requestByMessageIds(
				[...MOCK_MESSAGES, ...MOCK_MESSAGES_2].map((msg) =>
					msg.messageId.serialize()
				)
			);

			const contentValues = await streamToContentValues(resultStream);
			expect(contentValues).toEqual([1, 2, 3, 4, 5, 6]);
		});

		it('not found', async () => {
			const resultStream = logStore.requestByMessageId(
				createMockMessage(999).messageId.serialize()
			);
			const contentValues = await streamToContentValues(resultStream);
			expect(contentValues).toEqual([]);
		});

		it('not found in the middle', async () => {
			const resultStream = logStore.requestByMessageIds(
				[1, 999, 3].map((i) => createMockMessage(i).messageId.serialize())
			);
			const contentValues = await streamToContentValues(resultStream);
			expect(contentValues).toEqual([1, 3]);
		});
	});

	describe('requestLast', () => {
		it('happy path', async () => {
			const resultStream = logStore.requestLast(MOCK_STREAM_ID, 0, 2);
			const contentValues = await streamToContentValues(resultStream);
			expect(contentValues).toEqual([2, 3]);
		});

		it('no messages', async () => {
			const resultStream = logStore.requestLast(EMPTY_STREAM_ID, 0, 1);
			const contentValues = await streamToContentValues(resultStream);
			expect(contentValues).toEqual([]);
		});

		it('bucket query error', async () => {
			(logStore.cassandraClient as any).setError('FROM bucket');
			const resultStream = logStore.requestLast(MOCK_STREAM_ID, 0, 1);
			const [actualError] = await waitForEvent(resultStream, 'error');
			expect(actualError).toBe(ProxyClient.ERROR);
		});

		it('message count query error', async () => {
			(logStore.cassandraClient as any).setError('total FROM stream_data');
			const resultStream = logStore.requestLast(MOCK_STREAM_ID, 0, 1);
			const [actualError] = await waitForEvent(resultStream, 'error');
			expect(actualError).toBe(ProxyClient.ERROR);
		});

		it('message query error', async () => {
			(logStore.cassandraClient as any).setError('payload FROM stream_data');
			const resultStream = logStore.requestLast(MOCK_STREAM_ID, 0, 1);
			const [actualError] = await waitForEvent(resultStream, 'error');
			expect(actualError).toBe(ProxyClient.ERROR);
		});
	});

	describe.each([
		[REQUEST_TYPE_FROM, undefined, undefined],
		[REQUEST_TYPE_FROM, MOCK_PUBLISHER_ID, undefined],
		[REQUEST_TYPE_RANGE, undefined, undefined],
		[REQUEST_TYPE_RANGE, MOCK_PUBLISHER_ID, MOCK_MSG_CHAIN_ID],
	])(
		'%s, publisher: %p',
		(
			requestType: string,
			publisherId: string | undefined,
			msgChainId: string | undefined
		) => {
			const getResultStream = (streamId: string): Readable => {
				const minMockTimestamp = MOCK_MESSAGES[0].getTimestamp();
				const maxMockTimestamp =
					MOCK_MESSAGES[MOCK_MESSAGES.length - 1].getTimestamp();
				if (requestType === REQUEST_TYPE_FROM) {
					return logStore.requestFrom(
						streamId,
						0,
						minMockTimestamp,
						0,
						publisherId
					);
				} else if (requestType === REQUEST_TYPE_RANGE) {
					return logStore.requestRange(
						streamId,
						0,
						minMockTimestamp,
						0,
						maxMockTimestamp,
						0,
						publisherId,
						msgChainId
					);
				} else {
					throw new Error('Assertion failed');
				}
			};

			it('happy path', async () => {
				const resultStream = getResultStream(MOCK_STREAM_ID);
				const contentValues = await streamToContentValues(resultStream);
				expect(contentValues).toEqual([1, 2, 3]);
			});

			it('no messages', async () => {
				const resultStream = getResultStream(EMPTY_STREAM_ID);
				const contentValues = await streamToContentValues(resultStream);
				expect(contentValues).toEqual([]);
			});

			it('bucket query error', async () => {
				(logStore.cassandraClient as any).setError('FROM bucket');
				const resultStream = getResultStream(MOCK_STREAM_ID);
				const [actualError] = await waitForEvent(resultStream, 'error');
				expect(actualError).toBe(ProxyClient.ERROR);
			});

			it('message query error', async () => {
				(logStore.cassandraClient as any).setError('payload FROM stream_data');
				const resultStream = getResultStream(MOCK_STREAM_ID);
				const [actualError] = await waitForEvent(resultStream, 'error');
				expect(actualError).toBe(ProxyClient.ERROR);
			});
		}
	);
});
