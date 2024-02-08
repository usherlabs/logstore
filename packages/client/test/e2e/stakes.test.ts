import { fetchPrivateKeyWithGas } from '@streamr/test-utils';
import { providers, Wallet } from 'ethers';
import StreamrClient, {
	CONFIG_TEST as STREAMR_CONFIG_TEST,
} from 'streamr-client';
import * as T from 'effect';
import { Duration, Schedule } from 'effect';

import { CONFIG_TEST as LOGSTORE_CONFIG_TEST } from '../../src/ConfigTest';
import { LogStoreClient } from '../../src/LogStoreClient';
import { createTestStream } from '../test-utils/utils';
import { retry, tryPromise } from 'effect/Effect';

const STAKE_AMOUNT = BigInt('1000000000');
const TIMEOUT = 90 * 1000;

describe('stakes', () => {
	const provider = new providers.JsonRpcProvider(
		STREAMR_CONFIG_TEST.contracts?.streamRegistryChainRPCs?.rpcs[0].url,
		STREAMR_CONFIG_TEST.contracts?.streamRegistryChainRPCs?.chainId
	);

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
				const retryMechanism = retry(
					Schedule.compose(
						Schedule.exponential(200, 2),
						Schedule.recurUpTo(Duration.seconds(10))
					)
				);

				// Define the retry logic for expectStreamBalanceToBeOk function
				await T.Effect.runPromise(
					tryPromise(expectStreamBalanceToBeOk).pipe(retryMechanism)
				);
				await T.Effect.runPromise(
					tryPromise(expectStoreBalanceToBeOk).pipe(retryMechanism)
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
