import { LogStoreClient, Message } from '@logsn/client';
import { LogStoreManager, LogStoreQueryManager } from '@logsn/contracts';
import {
	getQueryManagerContract,
	getStoreManagerContract,
	prepareStakeForQueryManager,
	prepareStakeForStoreManager,
} from '@logsn/shared';
import { Stream, StreamPermission } from '@streamr-client';
import { fetchPrivateKeyWithGas } from '@streamr/test-utils';
import { providers, Wallet } from 'ethers';
import _ from 'lodash';
import { firstValueFrom, take, tap, toArray } from 'rxjs';
import Bench from 'tinybench';
import { afterAll, beforeAll, describe, expect, it, Test } from 'vitest';

// it's important to import CONFIG_TEST relatively, otherwise it won't work
import { CONFIG_TEST } from '../../client/src/ConfigTest';
import { collectBenchmarkResults } from './utils/benchmarking/collect-benchmark-results';
import { measure } from './utils/benchmarking/measure';
import { createJsonReporter } from './utils/benchmarking/reporters/json-reporter';
import { messagesFromQuery } from './utils/messages-from-query';
import { createTestStream } from './utils/test-stream';
import { sleep } from './utils/utils';

const TIMEOUT = 120 * 1000; // milliseconds;
const STAKE_AMOUNT = BigInt('1000000000000000000');
// time needed to be safe that messages were stored in milliseconds
// why 9 seconds? Copied from @logsn/client tests
const MESSAGE_STORE_TIMEOUT = 9 * 1000;

describe('Client Package Benchmarks', () => {
	const jsonReporter = createJsonReporter({ filename: 'client-package.json' });
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

	const benchs = {
		// we are not using warmup feature of tinybench because we can't save warmup stats
		hot: new Bench({
			iterations: 5, // it will run this number of iterations even if time is 1
			time: 1, // we want based on number of iterations, not time
		}),
		cold: new Bench({
			iterations: 2,
			time: 1,
		}),
	};

	beforeAll(async () => {
		// Accounts
		const privateKeys = await Promise.all([
			fetchPrivateKeyWithGas(),
			fetchPrivateKeyWithGas(),
			fetchPrivateKeyWithGas(),
		] as const);
		publisherAccount = new Wallet(privateKeys[0], provider);
		storeOwnerAccount = new Wallet(privateKeys[1], provider);
		storeConsumerAccount = new Wallet(privateKeys[2], provider);

		console.log('Accounts prepared');

		// Contracts
		[storeManager, queryManager] = await Promise.all([
			getStoreManagerContract(storeOwnerAccount),
			getQueryManagerContract(storeConsumerAccount),
		]);

		console.log('Contracts prepared');

		// Clients
		publisherClient = new LogStoreClient({
			...CONFIG_TEST,
			logLevel: 'error',
			auth: {
				privateKey: publisherAccount.privateKey,
			},
		});

		consumerClient = new LogStoreClient({
			...CONFIG_TEST,
			logLevel: 'error',
			auth: {
				privateKey: storeConsumerAccount.privateKey,
			},
		});
	}, TIMEOUT);

	afterAll(async () => {
		/*
		 We will collect all test benchmark results
		 and then save them on a json file
		 - if a test name is equal to previous data, it will get overwritten
		 - if we want to reset benchmarks, deleting result files and running tests agin will be enough
		 - new and old results merged then sorted by test name
		*/
		const result = {
			...collectBenchmarkResults(benchs.cold),
			...collectBenchmarkResults(benchs.hot),
		};

		await Promise.allSettled([
			publisherClient?.destroy(),
			consumerClient?.destroy(),
			jsonReporter.save(result),
		]);
	}, TIMEOUT);

	describe('public stream', () => {
		let stream: Stream;

		/// parallel publishing of a number of messages
		async function publishMessages(numOfMessages: number) {
			const promises: Promise<Message>[] = [];
			for (const idx of _.range(numOfMessages)) {
				promises.push(
					publisherClient.publish(
						{
							id: stream.id,
							partition: 0,
						},
						{
							messageNo: idx,
						}
					)
				);
			}
			return Promise.all(promises);
		}

		beforeAll(async () => {
			stream = await createTestStream(publisherClient, 'unique-temp-id', {
				partitions: 1,
			});

			// TODO: the consumer must have permission to subscribe to the stream or the stream have to be public
			const grantPermissionPromise = stream.grantPermissions({
				user: await consumerClient.getAddress(),
				permissions: [StreamPermission.SUBSCRIBE],
			});
			// await stream.grantPermissions({
			// 	public: true,
			// 	permissions: [StreamPermission.SUBSCRIBE],
			// });

			await Promise.all([
				grantPermissionPromise,
				prepareStakeForStoreManager(storeOwnerAccount, STAKE_AMOUNT),
				prepareStakeForQueryManager(storeConsumerAccount, STAKE_AMOUNT),
			]);

			console.log('Stakes prepared');

			await Promise.all([
				storeManager.stake(stream.id, STAKE_AMOUNT),
				queryManager.stake(STAKE_AMOUNT),
			]);

			console.log('Stakes staked');
		}, TIMEOUT);

		/**
		 * The act of sending messages, and then querying is abstracted here to easily create multiple batch cases on different tests
		 * It also validate outputs to make sure it works using `expect`
		 */
		async function sendAndQueryForNMessages(
			task: Readonly<Test<any>>,
			numberOfMessages: number
		) {
			const measureTask = measure(benchs);

			const sendResult = await measureTask({
				name: 'send ' + task.name,
				delayBetweenCycles: 200,
			})(async () => publishMessages(numberOfMessages));

			expect(sendResult?.samples).toBeDefined();

			// necessary step to make sure messages are stored
			// else next step will fail
			// TODO remove this someday as it leaves tests flaky
			await sleep(MESSAGE_STORE_TIMEOUT);

			// making sure all messages are received requires us to actualy store them here
			const messagesBatches: unknown[][] = [];

			// messages$ will be a cold stream
			// so it will restart on each iteration
			const messages$ = messagesFromQuery(consumerClient, stream, {
				last: numberOfMessages,
			}).pipe(
				// when we get the first message, we know it didn't hanged
				// emit complete signal when all messages are received
				take(numberOfMessages),
				toArray(),
				tap((msgs) => messagesBatches.push(msgs))
			);

			const queryResults = await measureTask({
				name: 'query ' + task.name,
				delayBetweenCycles: 200,
			})(async () => firstValueFrom(messages$));

			expect(
				// all batches contains correct number of messages
				messagesBatches.every((msgs) => msgs.length === numberOfMessages)
			).toBeTruthy();
			expect(queryResults?.samples).toBeDefined();
		}

		it(
			'1 message sent',
			async ({ task }) => {
				await sendAndQueryForNMessages(task, 1);
			},
			TIMEOUT
		);

		it(
			'20 messages sent in parallel',
			async ({ task }) => {
				await sendAndQueryForNMessages(task, 20);
			},
			TIMEOUT
		);
	});
});
