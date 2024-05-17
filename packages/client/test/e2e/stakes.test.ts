import StreamrClient, {
	CONFIG_TEST as STREAMR_CONFIG_TEST,
} from '@streamr/sdk';
import { fetchPrivateKeyWithGas } from '@streamr/test-utils';
import { Duration, Schedule } from 'effect';
import { Wallet } from 'ethers';

import { CONFIG_TEST as LOGSTORE_CONFIG_TEST } from '../../src/ConfigTest';
import { LogStoreClient } from '../../src/LogStoreClient';
import { createTestStream, getProvider } from '../test-utils/utils';
import { retryAsyncFnWithStrategy } from '../utils/retryAsyncFnWithStrategy';

const STAKE_AMOUNT = BigInt('1000000000');
const TIMEOUT = 90 * 1000;

describe('stakes', () => {
	const provider = getProvider();

	let account: Wallet;
	let streamrClient: StreamrClient;
	let logStoreClient: LogStoreClient;

	beforeAll(async () => {
		account = new Wallet(await fetchPrivateKeyWithGas(), provider);
		console.debug('Initializing tests for: ');
		console.debug(`Account address: ${account.address}`);
		console.debug(`Account private key: ${account.privateKey}`);
		streamrClient = new StreamrClient({
			...STREAMR_CONFIG_TEST,
			auth: {
				privateKey: account.privateKey,
			},
		});
		logStoreClient = new LogStoreClient(streamrClient, LOGSTORE_CONFIG_TEST);
	}, TIMEOUT);

	afterAll(async () => {
		await Promise.allSettled([
			streamrClient?.destroy(),
			logStoreClient?.destroy(),
		]);
	}, TIMEOUT);

	describe('stake store', () => {
		test(
			'store',
			async () => {
				const previousStoreBalance = await logStoreClient.getStoreBalance();

				const stream = await createTestStream(streamrClient, module);
				await logStoreClient.stakeOrCreateStore(stream.id, STAKE_AMOUNT);

				// these functions are not working in the first time always.
				// So we create a retry mechanism to make sure that the balance is updated.
				const expectStreamBalanceToBeOk = () =>
					expect(logStoreClient.getStreamBalance(stream.id)).resolves.toBe(
						STAKE_AMOUNT
					);

				const expectStoreBalanceToBeOk = () =>
					expect(logStoreClient.getStoreBalance()).resolves.toBe(
						STAKE_AMOUNT + previousStoreBalance
					);

				// Define the retry mechanism with exponential backoff and max 10 seconds
				const backoffStrategy = Schedule.compose(
					Schedule.exponential(200, 2),
					Schedule.recurUpTo(Duration.seconds(10))
				);

				await retryAsyncFnWithStrategy(
					expectStreamBalanceToBeOk,
					backoffStrategy
				);
				await retryAsyncFnWithStrategy(
					expectStoreBalanceToBeOk,
					backoffStrategy
				);
			},
			TIMEOUT
		);

		test(
			'stake query',
			async () => {
				const previousBalance = await logStoreClient.getQueryBalance();

				await logStoreClient.queryStake(STAKE_AMOUNT);
				const queryBalance = await logStoreClient.getQueryBalance();

				expect(queryBalance).toBe(STAKE_AMOUNT + previousBalance);
			},
			TIMEOUT
		);
	});
});
