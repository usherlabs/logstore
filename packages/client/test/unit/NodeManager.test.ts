import { fetchPrivateKeyWithGas } from '@streamr/test-utils';
import { providers, Wallet } from 'ethers';
import StreamrClient, {
	CONFIG_TEST as STREAMR_CONFIG_TEST,
} from 'streamr-client';

import { CONFIG_TEST as LOGSTORE_CONFIG_TEST } from '../../src/ConfigTest';
import { LogStoreClient } from '../../src/LogStoreClient';
import { sleep } from '../test-utils/sleep';

const STAKE_AMOUNT = BigInt('1000000000');
const TIMEOUT = 90 * 1000;

describe('NodeManager', () => {
	const provider = new providers.JsonRpcProvider(
		STREAMR_CONFIG_TEST.contracts?.streamRegistryChainRPCs?.rpcs[0].url,
		STREAMR_CONFIG_TEST.contracts?.streamRegistryChainRPCs?.chainId
	);

	let account: Wallet;
	let streamrClient: StreamrClient;

	beforeAll(async () => {
		jest.useFakeTimers({ advanceTimers: true });
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
	}, TIMEOUT);

	afterAll(async () => {
		await Promise.allSettled([
			streamrClient?.destroy(),
			// logStoreClient?.destroy(),
		]);
	}, TIMEOUT);

	test(
		'getBestUrls',
		async () => {
			const logStoreClient = new LogStoreClient(
				streamrClient,
				LOGSTORE_CONFIG_TEST
			);

			await sleep(7000);

			const bestUrls = await logStoreClient.getBestNodeUrls();
			console.log({ bestUrls });

			expect(bestUrls.length).toBeGreaterThan(1);

			jest.advanceTimersByTime(305_000);

			const bestUrls2 = await logStoreClient.getBestNodeUrls();
			console.log({ bestUrls2 });

			expect(bestUrls2.length).toBeGreaterThan(1);

			await sleep(3_500);

			console.log('NO MORE UPDATES EXPECTED');

			await sleep(5_000);
		},
		TIMEOUT
	);
});
