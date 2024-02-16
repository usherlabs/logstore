import { fetchPrivateKeyWithGas } from '@streamr/test-utils';
import { providers, Wallet } from 'ethers';
import StreamrClient, {
	CONFIG_TEST as STREAMR_CONFIG_TEST,
} from 'streamr-client';

import { CONFIG_TEST as LOGSTORE_CONFIG_TEST } from '../../src/ConfigTest';
import { LogStoreClient } from '../../src/LogStoreClient';
import { createTestStream } from '../test-utils/utils';

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
				const previousBalance = await logStoreClient.getStoreBalance();

				const stream = await createTestStream(streamrClient, module);
				await logStoreClient.stakeOrCreateStore(stream.id, STAKE_AMOUNT);
				const storeBalance = await logStoreClient.getStreamBalance(stream.id);
				const accountBalance = await logStoreClient.getStoreBalance();
				expect(storeBalance).toBe(STAKE_AMOUNT);
				expect(accountBalance).toBe(STAKE_AMOUNT + previousBalance);
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
