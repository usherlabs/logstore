import { LogStoreManager, LogStoreQueryManager } from '@logsn/contracts';
import {
	getQueryManagerContract,
	getStoreManagerContract,
	prepareStakeForQueryManager,
	prepareStakeForStoreManager,
} from '@logsn/shared';
import { Stream, StreamPermission } from '@logsn/streamr-client';
import { MessageID, StreamMessage, toStreamID } from '@streamr/protocol';
import { fetchPrivateKeyWithGas } from '@streamr/test-utils';
import { wait, waitForCondition } from '@streamr/utils';
import axios from 'axios';
import { providers, Wallet } from 'ethers';
import { range } from 'lodash';

import { CONFIG_TEST } from '../../src/ConfigTest';
import { LogStoreClient } from '../../src/LogStoreClient';
import { createTestStream } from '../test-utils/utils';

const STAKE_AMOUNT = BigInt('1000000000000000000');
const NUM_OF_LAST_MESSAGES = 20;
const NUM_OF_FROM_MESSAGES = 15;
const NUM_OF_RANGE_MESSAGES = 10;
const MESSAGE_STORE_TIMEOUT = 15 * 1000;
const TIMEOUT = 90 * 1000;

const BASE_NODE_URL = `http://localhost:7771`;

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(() => resolve(undefined), ms));
}

describe('query', () => {
	const provider = new providers.JsonRpcProvider(
		CONFIG_TEST.contracts?.streamRegistryChainRPCs?.rpcs[0].url,
		CONFIG_TEST.contracts?.streamRegistryChainRPCs?.chainId
	);

	// Accounts
	let publisherAccount: Wallet;
	let storeOwnerAccount: Wallet;
	let storeConsumerAccount: Wallet;

	// Clients
	let publisherClient: LogStoreClient;
	let consumerClient: LogStoreClient;

	// Contracts
	let storeManager: LogStoreManager;
	let queryManager: LogStoreQueryManager;

	beforeAll(async () => {
		// Accounts
		const walletsForAccounts = await Promise.all([
			fetchPrivateKeyWithGas(),
			fetchPrivateKeyWithGas(),
			fetchPrivateKeyWithGas(),
		]);

		publisherAccount = new Wallet(walletsForAccounts[0], provider);
		storeOwnerAccount = new Wallet(walletsForAccounts[1], provider);
		storeConsumerAccount = new Wallet(walletsForAccounts[2], provider);

		// Contracts
		[storeManager, queryManager] = await Promise.all([
			getStoreManagerContract(storeOwnerAccount),
			getQueryManagerContract(storeConsumerAccount),
		]);

		// Clients
		publisherClient = new LogStoreClient({
			...CONFIG_TEST,
			auth: {
				privateKey: publisherAccount.privateKey,
			},
		});

		consumerClient = new LogStoreClient({
			...CONFIG_TEST,
			auth: {
				privateKey: storeConsumerAccount.privateKey,
			},
		});
	}, TIMEOUT);

	afterAll(async () => {
		await Promise.allSettled([
			publisherClient?.destroy(),
			consumerClient?.destroy(),
		]);
	}, TIMEOUT);

	describe('private stream', () => {
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

		beforeAll(async () => {
			stream = await createTestStream(publisherClient, module, {
				partitions: 1,
			});

			// TODO: the consumer must have permission to subscribe to the stream or the strem have to be public
			await stream.grantPermissions({
				user: await consumerClient.getAddress(),
				permissions: [StreamPermission.SUBSCRIBE],
			});
			// await stream.grantPermissions({
			// 	public: true,
			// 	permissions: [StreamPermission.SUBSCRIBE],
			// });

			await Promise.all([
				prepareStakeForStoreManager(storeOwnerAccount, STAKE_AMOUNT),
				prepareStakeForQueryManager(storeConsumerAccount, STAKE_AMOUNT),
			]);

			await Promise.all([
				storeManager.stake(stream.id, STAKE_AMOUNT),
				queryManager.stake(STAKE_AMOUNT),
			]);
		}, TIMEOUT);

		it(
			'can request a query for the last messages',
			async () => {
				await publishMessages(NUM_OF_LAST_MESSAGES);

				const messages: StreamMessage[] = [];
				await consumerClient.query(
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
				expect(messages[0]).toMatchObject({ messageNo: 0 });
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
				await consumerClient.query(
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
				await consumerClient.query(
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

		describe('can request a query for the last messages via HTTP Interface', () => {
			let queryUrl: string;
			let token: string;

			beforeAll(async () => {
				await publishMessages(NUM_OF_LAST_MESSAGES);

				queryUrl = await consumerClient.createQueryUrl(
					BASE_NODE_URL,
					{
						streamId: stream.id,
						partition: 0,
					},
					'last',
					{
						count: NUM_OF_LAST_MESSAGES,
					}
				);
				({ token } = await consumerClient.apiAuth());
			}, TIMEOUT);

			it(
				'via json responses',
				async () => {
					const resp = await axios
						.get(queryUrl, {
							headers: {
								Authorization: `Basic ${token}`,
							},
						})
						.then(({ data }) => data as { messages: any[] });

					console.log('HTTP RESPONSE:', resp);

					expect(resp.messages).toHaveLength(NUM_OF_LAST_MESSAGES);
					const data = resp.messages.map(
						({
							streamId,
							streamPartition,
							timestamp,
							sequenceNumber,
							publisherId,
							msgChainId,
							messageType,
							contentType,
							encryptionType,
							groupKeyId,
							content,
							signature,
						}) =>
							new StreamMessage({
								messageId: new MessageID(
									toStreamID(streamId),
									streamPartition,
									timestamp,
									sequenceNumber,
									publisherId,
									msgChainId
								),
								content,
								encryptionType,
								groupKeyId,
								signature,
								contentType,
								messageType,
							})
					);

					expect(data[0]).toMatchObject({ messageNo: 0 });
				},
				TIMEOUT
			);

			it(
				'via stream',
				async () => {
					const streamJson = await axios.get(queryUrl, {
						headers: {
							Authorization: `Basic ${token}`,
							Accept: 'text/event-stream',
						},
						responseType: 'stream',
					});

					const messages: unknown[] = [];
					streamJson.data.on('data', (chunk: any) => {
						messages.push(JSON.parse(chunk));
					});

					await new Promise((resolve) => {
						streamJson.data.on('end', resolve);
					});

					console.log('HTTP STREAM RESPONSE:', messages);
					expect(messages).toHaveLength(NUM_OF_LAST_MESSAGES);
				},
				TIMEOUT
			);
		});
	});
});
