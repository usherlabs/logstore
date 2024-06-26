import {
	CONFIG_TEST as LOGSTORE_CONFIG_TEST,
	LogStoreClient,
} from '@logsn/client';
import { LogStoreManager, LogStoreQueryManager } from '@logsn/contracts';
import {
	getQueryManagerContract,
	getStoreManagerContract,
	prepareStakeForQueryManager,
	prepareStakeForStoreManager,
} from '@logsn/shared';
import { config as CHAIN_CONFIG } from '@streamr/config';
import StreamrClient, {
	Message,
	CONFIG_TEST as STREAMR_CONFIG_TEST,
	Stream,
	StreamPermission,
} from '@streamr/sdk';
import { fetchPrivateKeyWithGas } from '@streamr/test-utils';
import { Wallet, providers } from 'ethers';
import _ from 'lodash';
import { firstValueFrom, take, tap, toArray } from 'rxjs';
import Bench from 'tinybench';
import { Logger } from 'tslog';
import { Test, afterAll, beforeAll, describe, expect, it } from 'vitest';

// it's important to import CONFIG_TEST relatively, otherwise it won't work
import {
	LOG_LEVEL,
	NUMBER_OF_ITERATIONS,
	TEST_TIMEOUT,
} from './environment-vars';
import { collectBenchmarkResults } from './utils/benchmarking/collect-benchmark-results';
import { measure } from './utils/benchmarking/measure';
import { createJsonReporter } from './utils/benchmarking/reporters/json-reporter';
import { messagesFromQuery } from './utils/messages-from-query';
import { createTestStream } from './utils/test-stream';
import { sleep } from './utils/utils';

const logger = new Logger();
const STAKE_AMOUNT = BigInt('1000000000000000000');

// time needed to be safe that messages were stored in milliseconds
// why 9 seconds? Copied from @logsn/client tests
const MESSAGE_STORE_TIMEOUT = 9 * 1000;

describe('Client Package Benchmarks', () => {
	const jsonReporter = createJsonReporter({ filename: 'client-package.json' });
	const provider = new providers.JsonRpcProvider(CHAIN_CONFIG.dev2.rpcEndpoints[0].url);

	// Accounts
	let publisherAccount: Wallet;
	let storeOwnerAccount: Wallet;
	let storeConsumerAccount: Wallet;

	// Clients
	let publisherClient: StreamrClient;
	let consumerStreamrClient: StreamrClient;
	let consumerLogStoreClient: LogStoreClient;

	// Contracts
	let storeManager: LogStoreManager;
	let queryManager: LogStoreQueryManager;

	const benchs = {
		// we are not using warmup feature of tinybench because we can't save warmup stats
		hot: new Bench({
			iterations: +NUMBER_OF_ITERATIONS, // it will run this number of iterations even if time is 1
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

		logger.info('Accounts prepared');

		// Contracts
		[storeManager, queryManager] = await Promise.all([
			getStoreManagerContract(storeOwnerAccount),
			getQueryManagerContract(storeConsumerAccount),
		]);

		logger.info('Contracts prepared');

		// Clients
		publisherClient = new StreamrClient({
			...STREAMR_CONFIG_TEST,
			// eslint-disable-next-line
			// @ts-ignore
			logLevel: 'debug',
			auth: {
				privateKey: publisherAccount.privateKey,
			},
		});

		consumerStreamrClient = new StreamrClient({
			...STREAMR_CONFIG_TEST,
			// eslint-disable-next-line
			// @ts-ignore
			logLevel: LOG_LEVEL,
			auth: {
				privateKey: storeConsumerAccount.privateKey,
			},
		});
		consumerLogStoreClient = new LogStoreClient(consumerStreamrClient, {
			...LOGSTORE_CONFIG_TEST,
			// eslint-disable-next-line
			// @ts-ignore
			logLevel: LOG_LEVEL,
		});
	}, TEST_TIMEOUT);

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
			consumerLogStoreClient?.destroy(),
			jsonReporter.save(result),
		]);
	}, TEST_TIMEOUT);

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
				user: await consumerStreamrClient.getAddress(),
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

			logger.info('Stakes prepared');

			await Promise.all([
				storeManager.stake(stream.id, STAKE_AMOUNT),
				queryManager.stake(STAKE_AMOUNT),
			]);

			logger.info('Stakes staked');
		}, TEST_TIMEOUT);

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
			const messages$ = messagesFromQuery(consumerLogStoreClient, stream, {
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
			TEST_TIMEOUT
		);

		it(
			'20 messages sent in parallel',
			async ({ task }) => {
				await sendAndQueryForNMessages(task, 20);
			},
			TEST_TIMEOUT
		);
	});
});
