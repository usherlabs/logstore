import { fastPrivateKey, fetchPrivateKeyWithGas } from '@streamr/test-utils';
import { wait, waitForCondition } from '@streamr/utils';
import { BigNumber } from 'ethers';
import { range } from 'lodash';
import { Stream } from 'streamr-client';

import { CONFIG_TEST } from '../../src/ConfigTest';
import { LogStoreClient } from '../../src/LogStoreClient';
import { createTestStream } from '../test-utils/utils';

const STAKE_AMOUNT = BigNumber.from('100000000000000000');
const NUM_OF_LAST_MESSAGES = 20;
const NUM_OF_FROM_MESSAGES = 15;
const NUM_OF_RANGE_MESSAGES = 10;
const MESSAGE_STORE_TIMEOUT = 9 * 1000;
const TIMEOUT = 90 * 1000;

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(() => resolve(undefined), ms));
}

describe('query', () => {
	let publisherClient: LogStoreClient;
	let queryClient: LogStoreClient;

	beforeEach(async () => {
		publisherClient = new LogStoreClient({
			...CONFIG_TEST,
			auth: {
				privateKey: await fetchPrivateKeyWithGas(),
			},
		});
		queryClient = new LogStoreClient({
			...CONFIG_TEST,
			auth: {
				privateKey: fastPrivateKey(),
			},
		});
	}, TIMEOUT);

	afterEach(async () => {
		await Promise.allSettled([
			publisherClient?.destroy(),
			queryClient?.destroy(),
		]);
	}, TIMEOUT);

	describe('public stream', () => {
		let stream: Stream;

		async function publishMessages(numOfMessages: number) {
			for (const idx of range(numOfMessages)) {
				await publisherClient.publish(
					{
						id: stream.id,
						partition: 0,
					},
					{
						messageNo: idx,
					}
				);
				await sleep(100);
			}
			await wait(MESSAGE_STORE_TIMEOUT);
		}

		beforeEach(async () => {
			stream = await createTestStream(publisherClient, module, {
				partitions: 1,
			});
			await publisherClient.addStreamToLogStore(stream.id, STAKE_AMOUNT);
		}, TIMEOUT);

		it(
			'can request a query for the last messages',
			async () => {
				await publishMessages(NUM_OF_LAST_MESSAGES);

				const messages: unknown[] = [];
				await queryClient.query(
					{
						streamId: stream.id,
						partition: 0,
					},
					{ last: NUM_OF_LAST_MESSAGES },
					(msg: any) => {
						messages.push(msg);
					}
				);
				await waitForCondition(
					() => messages.length >= NUM_OF_LAST_MESSAGES,
					TIMEOUT - 1000,
					250,
					undefined,
					() => `messages array length was ${messages.length}`
				);
				expect(messages).toHaveLength(NUM_OF_LAST_MESSAGES);
			},
			TIMEOUT
		);

		it(
			'can request a query for messages from a timestamp',
			async () => {
				await publishMessages(5);

				const fromTimestamp = Date.now();
				await publishMessages(NUM_OF_FROM_MESSAGES);

				const messages: unknown[] = [];
				await queryClient.query(
					{
						streamId: stream.id,
						partition: 0,
					},
					{ from: { timestamp: fromTimestamp } },
					(msg: any) => {
						messages.push(msg);
					}
				);
				await waitForCondition(
					() => messages.length >= NUM_OF_FROM_MESSAGES,
					TIMEOUT - 1000,
					250,
					undefined,
					() => `messages array length was ${messages.length}`
				);
				expect(messages).toHaveLength(NUM_OF_FROM_MESSAGES);
			},
			TIMEOUT
		);

		it(
			'can request a query for messages for a range of timestamps',
			async () => {
				await publishMessages(5);

				const fromTimestamp = Date.now();
				await publishMessages(NUM_OF_RANGE_MESSAGES);
				const toTimestamp = Date.now();

				await sleep(100);
				await publishMessages(5);

				const messages: unknown[] = [];
				await queryClient.query(
					{
						streamId: stream.id,
						partition: 0,
					},
					{
						from: { timestamp: fromTimestamp },
						to: { timestamp: toTimestamp },
					},
					(msg: any) => {
						messages.push(msg);
					}
				);
				await waitForCondition(
					() => messages.length >= NUM_OF_RANGE_MESSAGES,
					TIMEOUT - 1000,
					250,
					undefined,
					() => `messages array length was ${messages.length}`
				);
				expect(messages).toHaveLength(NUM_OF_RANGE_MESSAGES);
			},
			TIMEOUT
		);
	});
});
