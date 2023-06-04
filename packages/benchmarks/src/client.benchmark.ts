
// import LogStoreClient, {
// 	Stream,
// 	StreamPermission,
// } from '@logsn/client';
// import {
// 	LogStoreManager,
// 	LogStoreQueryManager,
// } from '@logsn/contracts';
// import {
// 	getQueryManagerContract,
// 	getStoreManagerContract,
// 	prepareStakeForQueryManager,
// 	prepareStakeForStoreManager,
// } from '@logsn/shared';
// import { fetchPrivateKeyWithGas } from '@streamr/test-utils';
// import { wait, waitForCondition } from '@streamr/utils';
// import { providers, Wallet } from 'ethers';
// import { range } from 'lodash';

// import { CONFIG_TEST } from '../../client/src/ConfigTest';

// import { createTestStream } from '../test-utils/utils';

// const STAKE_AMOUNT = BigInt('1000000000000000000');
// const NUM_OF_LAST_MESSAGES = 20;
// const NUM_OF_FROM_MESSAGES = 15;
// const NUM_OF_RANGE_MESSAGES = 10;
// const MESSAGE_STORE_TIMEOUT = 9 * 1000;
// const TIMEOUT = 90 * 1000;

// // Accounts
// let publisherAccount;
// let storeOwnerAccount;
// let storeConsumerAccount;

// // Clients
// let publisherClient;
// let consumerClient;

// // Contracts
// let storeManager;
// let queryManager;

describe('Client Package', () => {
	beforeAll(async () => {
		// const provider = new providers.JsonRpcProvider(
		// 	CONFIG_TEST.contracts?.streamRegistryChainRPCs?.rpcs[0].url,
		// 	CONFIG_TEST.contracts?.streamRegistryChainRPCs?.chainId
		// );
		// // Accounts
		// publisherAccount = new Wallet(await fetchPrivateKeyWithGas(), provider);
		// storeOwnerAccount = new Wallet(await fetchPrivateKeyWithGas(), provider);
		// storeConsumerAccount = new Wallet(await fetchPrivateKeyWithGas(), provider);
		// // Contracts
		// storeManager = await getStoreManagerContract(storeOwnerAccount);
		// queryManager = await getQueryManagerContract(storeConsumerAccount);
		// // Clients
		// publisherClient = new LogStoreClient({
		// 	...CONFIG_TEST,
		// 	auth: {
		// 		privateKey: publisherAccount.privateKey,
		// 	},
		// });
		// consumerClient = new LogStoreClient({
		// 	...CONFIG_TEST,
		// 	auth: {
		// 		privateKey: storeConsumerAccount.privateKey,
		// 	},
		// });
	});

	// afterAll(async () => {
	// 	await Promise.allSettled([
	// 		publisherClient?.destroy(),
	// 		consumerClient?.destroy(),
	// 	]);
	// });

	benchmark('test benchmark', async () => {
		run(async () => {
			return 1;
		});
	});
	// benchmark('publish message', async () => {
	// 	const message = await publisherClient.publish(
	// 		{
	// 			id: stream.id,
	// 			partition: 0,
	// 		},
	// 		{
	// 			messageNo: 1,
	// 		}
	// 	);
	// 	return `${message.timestamp}${message.seq}`;
	// });
	// benchmark('query message', () => {});
	// benchmark('publish 100 messages', () => {});
	// benchmark('query 100 messages', () => {});
	// benchmark('publish 1000 messages', () => {});
	// benchmark('query 1000 messages', () => {});
});

// describe('query', () => {
// 	afterAll(async () => {
// 		await Promise.allSettled([
// 			publisherClient?.destroy(),
// 			consumerClient?.destroy(),
// 		]);
// 	}, TIMEOUT);

// 	describe('public stream', () => {
// 		let stream: Stream;

// 		async function publishMessages(numOfMessages: number) {
// 			for (const idx of range(numOfMessages)) {
// 				await publisherClient.publish(
// 					{
// 						id: stream.id,
// 						partition: 0,
// 					},
// 					{
// 						messageNo: idx,
// 					}
// 				);
// 				await sleep(100);
// 			}
// 			await wait(MESSAGE_STORE_TIMEOUT);
// 		}

// 		beforeAll(async () => {
// 			stream = await createTestStream(publisherClient, module, {
// 				partitions: 1,
// 			});

// 			// TODO: the consumer must have permission to subscribe to the stream or the strem have to be public
// 			await stream.grantPermissions({
// 				user: await consumerClient.getAddress(),
// 				permissions: [StreamPermission.SUBSCRIBE],
// 			});
// 			// await stream.grantPermissions({
// 			// 	public: true,
// 			// 	permissions: [StreamPermission.SUBSCRIBE],
// 			// });

// 			await prepareStakeForStoreManager(storeOwnerAccount, STAKE_AMOUNT);
// 			await storeManager.stake(stream.id, STAKE_AMOUNT);

// 			await prepareStakeForQueryManager(storeConsumerAccount, STAKE_AMOUNT);
// 			await queryManager.stake(STAKE_AMOUNT);
// 		}, TIMEOUT);

// 		it(
// 			'can request a query for the last messages',
// 			async () => {
// 				await publishMessages(NUM_OF_LAST_MESSAGES);

// 				const messages: unknown[] = [];
// 				await consumerClient.query(
// 					{
// 						streamId: stream.id,
// 						partition: 0,
// 					},
// 					{ last: NUM_OF_LAST_MESSAGES },
// 					(msg: any) => {
// 						messages.push(msg);
// 					}
// 				);
// 				await waitForCondition(
// 					() => messages.length >= NUM_OF_LAST_MESSAGES,
// 					TIMEOUT - 1000,
// 					250,
// 					undefined,
// 					() => `messages array length was ${messages.length}`
// 				);
// 				expect(messages).toHaveLength(NUM_OF_LAST_MESSAGES);
// 			},
// 			TIMEOUT
// 		);

// 		it(
// 			'can request a query for messages from a timestamp',
// 			async () => {
// 				await publishMessages(5);

// 				const fromTimestamp = Date.now();
// 				await publishMessages(NUM_OF_FROM_MESSAGES);

// 				const messages: unknown[] = [];
// 				await consumerClient.query(
// 					{
// 						streamId: stream.id,
// 						partition: 0,
// 					},
// 					{ from: { timestamp: fromTimestamp } },
// 					(msg: any) => {
// 						messages.push(msg);
// 					}
// 				);
// 				await waitForCondition(
// 					() => messages.length >= NUM_OF_FROM_MESSAGES,
// 					TIMEOUT - 1000,
// 					250,
// 					undefined,
// 					() => `messages array length was ${messages.length}`
// 				);
// 				expect(messages).toHaveLength(NUM_OF_FROM_MESSAGES);
// 			},
// 			TIMEOUT
// 		);

// 		it(
// 			'can request a query for messages for a range of timestamps',
// 			async () => {
// 				await publishMessages(5);

// 				const fromTimestamp = Date.now();
// 				await publishMessages(NUM_OF_RANGE_MESSAGES);
// 				const toTimestamp = Date.now();

// 				await sleep(100);
// 				await publishMessages(5);

// 				const messages: unknown[] = [];
// 				await consumerClient.query(
// 					{
// 						streamId: stream.id,
// 						partition: 0,
// 					},
// 					{
// 						from: { timestamp: fromTimestamp },
// 						to: { timestamp: toTimestamp },
// 					},
// 					(msg: any) => {
// 						messages.push(msg);
// 					}
// 				);
// 				await waitForCondition(
// 					() => messages.length >= NUM_OF_RANGE_MESSAGES,
// 					TIMEOUT - 1000,
// 					250,
// 					undefined,
// 					() => `messages array length was ${messages.length}`
// 				);
// 				expect(messages).toHaveLength(NUM_OF_RANGE_MESSAGES);
// 			},
// 			TIMEOUT
// 		);
// 	});
// });
