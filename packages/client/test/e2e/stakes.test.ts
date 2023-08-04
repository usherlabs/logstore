import { fetchPrivateKeyWithGas } from '@streamr/test-utils';
import { providers, Wallet } from 'ethers';

import { CONFIG_TEST } from '../../src/ConfigTest';
import { LogStoreClient } from '../../src/LogStoreClient';
import { createTestStream } from '../test-utils/utils';

const STAKE_AMOUNT = BigInt('1000000000');
const TIMEOUT = 90 * 1000;

describe('stakes', () => {
	const provider = new providers.JsonRpcProvider(
		CONFIG_TEST.contracts?.streamRegistryChainRPCs?.rpcs[0].url,
		CONFIG_TEST.contracts?.streamRegistryChainRPCs?.chainId
	);

	let account: Wallet;
	let accountClient: LogStoreClient;

	beforeAll(async () => {
		account = new Wallet(await fetchPrivateKeyWithGas(), provider);
		console.debug('Initializing tests for: ');
		console.debug(`Account address: ${account.address}`);
		console.debug(`Account private key: ${account.privateKey}`);
		accountClient = new LogStoreClient({
			...CONFIG_TEST,
			auth: {
				privateKey: account.privateKey,
			},
		});
	}, TIMEOUT);

	afterAll(async () => {
		await Promise.allSettled([accountClient?.destroy()]);
	}, TIMEOUT);

	describe('stake store', () => {
		test(
			'store',
			async () => {
				const stream = await createTestStream(accountClient, module);
				await accountClient.stakeOrCreateStore(stream.id, STAKE_AMOUNT);
				const storeBalance = await accountClient.getStoreBalance(stream.id);
				expect(storeBalance).toBe(STAKE_AMOUNT);
			},
			TIMEOUT
		);

		test(
			'stake query',
			async () => {
				await accountClient.queryStake(STAKE_AMOUNT);
				const queryBalance = await accountClient.getQueryBalance();
				expect(queryBalance).toBe(STAKE_AMOUNT);
			},
			TIMEOUT
		);
	});
});
