describe('Encryption subleties', () => {
  it("dummy test", () => { })
});

// import StreamrClient, {
// 	CONFIG_TEST as STREAMR_CONFIG_TEST,
// } from '@streamr/sdk';
// import { fetchPrivateKeyWithGas } from '@streamr/test-utils';
// import { Wallet } from 'ethers';

// import { CONFIG_TEST as LOGSTORE_CONFIG_TEST } from '../../src/ConfigTest';
// import { LogStoreClient } from '../../src/LogStoreClient';
// import { sleep } from '../test-utils/sleep';
// import { getProvider } from '../test-utils/utils';

// const TIMEOUT = 90 * 1000;

// describe('NodeManager', () => {
// 	const provider = getProvider();

// 	let account: Wallet;
// 	let streamrClient: StreamrClient;

// 	beforeAll(async () => {
// 		jest.useFakeTimers({ advanceTimers: true });
// 		account = new Wallet(await fetchPrivateKeyWithGas(), provider);
// 		console.debug('Initializing tests for: ');
// 		console.debug(`Account address: ${account.address}`);
// 		console.debug(`Account private key: ${account.privateKey}`);
// 		streamrClient = new StreamrClient({
// 			...STREAMR_CONFIG_TEST,
// 			auth: {
// 				privateKey: account.privateKey
// 			}
// 		});
// 	}, TIMEOUT);

// 	afterEach(async () => {
// 		jest.clearAllMocks();
// 	});

// 	afterAll(async () => {
// 		await Promise.allSettled([
// 			streamrClient?.destroy()
// 		]);
// 	}, TIMEOUT);

// 	test(
// 		'getBestUrls',
// 		async () => {
// 			let updateCalls = 0;
// 			using logStoreClient = new LogStoreClient(
// 				streamrClient,
// 				LOGSTORE_CONFIG_TEST
// 			);

// 			const nodeManager = logStoreClient['logStoreNodeManager'];

// 			const spiedUpdate = jest.spyOn(nodeManager['lastUrlList$'], 'next');
// 			const getUpdateCalls = () => spiedUpdate.mock.calls.length;

// 			const expectUpdateIncrease = () => {
// 				const newCalls = getUpdateCalls();
// 				expect(newCalls).toBeGreaterThan(updateCalls);
// 				updateCalls = newCalls;
// 			};
// 			const expectSameUpdateCalls = () => {
// 				expect(getUpdateCalls()).toBe(updateCalls);
// 			};

// 			// more than 5 seconds to make sure there's time to trigger the first update and stop
// 			await sleep(7000);

// 			updateCalls = getUpdateCalls();

// 			const bestUrls = await logStoreClient.getNodeUrlsByLatency();

// 			expectSameUpdateCalls();

// 			expect(bestUrls.length).toBeGreaterThan(1);

// 			// advance timer, in order to trigger the cache while revalidate behavior on next trial
// 			jest.advanceTimersByTime(305_000);

// 			expectSameUpdateCalls();

// 			const bestUrls2 = await logStoreClient.getNodeUrlsByLatency();
// 			expect(bestUrls2.length).toBeGreaterThan(1);

// 			// more than 3 seconds to make sure there's time to end the next update
// 			await sleep(4_500);

// 			expectUpdateIncrease();

// 			await sleep(5_000);

// 			expectSameUpdateCalls();
// 		},
// 		TIMEOUT
// 	);
// });
