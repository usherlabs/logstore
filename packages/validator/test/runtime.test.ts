import { CONFIG_TEST, LogStoreClient } from '@concertodao/logstore-client';
// import { BigNumber } from '@ethersproject/bignumber';
import {
	// ICacheProvider,
	ICompression,
	IStorageProvider,
} from '@kyvejs/protocol';
import { setupMetrics } from '@kyvejs/protocol/src/methods';
import { TestCacheProvider } from '@kyvejs/protocol/test/mocks/cache.mock';
import { client } from '@kyvejs/protocol/test/mocks/client.mock';
import { TestNormalCompression } from '@kyvejs/protocol/test/mocks/compression.mock';
import { lcd } from '@kyvejs/protocol/test/mocks/lcd.mock';
// import { VoteType } from "@kyvejs/types/client/kyve/bundles/v1beta1/tx";
import { TestNormalStorageProvider } from '@kyvejs/protocol/test/mocks/storageProvider.mock';
import { fastPrivateKey, fetchPrivateKeyWithGas } from '@streamr/test-utils';
import { wait } from '@streamr/utils';
import { ethers } from 'ethers';
import { range } from 'lodash';
import { fromString } from 'uint8arrays/from-string';

// import { Logger } from 'tslog';
import Runtime from '../src/runtime';
import Validator, { runCache } from '../src/validator';
import { genesis_pool } from './mocks/constants';

// const STAKE_AMOUNT = BigNumber.from('100000000000000000');
const TIMEOUT = 90 * 1000;
const MESSAGE_STORE_TIMEOUT = 9 * 1000;
function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(() => resolve(true), ms));
}

describe('Validator Runtime', () => {
	let v: Validator;

	let processExit: jest.Mock<never, never>;
	let setTimeoutMock: jest.Mock;

	// let cacheProvider: ICacheProvider;
	let storageProvider: IStorageProvider;
	let compression: ICompression;
	let publisherClient: LogStoreClient;

	const publishQueryMessages = async (numOfMessages: number) => {
		// const [consumerSigner] = provider.getWallets();
		const priv = await fastPrivateKey();
		const signingKey = new ethers.SigningKey(priv);
		for (const idx of range(numOfMessages)) {
			const query = {
				from: {
					timestamp: 0,
				},
				to: {
					timestamp: 0,
				},
			};
			const nonce = idx;
			const queryStr = JSON.stringify(query);
			const hash = ethers.keccak256(fromString(queryStr + nonce));
			const sig = signingKey.sign(hash);
			await publisherClient.publish(
				{
					id: v.queryStreamId,
					partition: 0,
				},
				{
					query,
					nonce,
					consumer: signingKey.publicKey,
					sig,
					hash,
					size: Buffer.byteLength(queryStr, 'utf8'),
				}
			);
			await sleep(100);
		}
		await wait(MESSAGE_STORE_TIMEOUT);
	};
	const publishStorageMessages = async (numOfMessages: number) => {
		for (const idx of range(numOfMessages)) {
			const msg = { messageNo: idx };
			const msgStr = JSON.stringify(msg);
			const hash = ethers.keccak256(fromString(msgStr));
			await publisherClient.publish(
				{
					id: v.systemStreamId,
					partition: 0,
				},
				{
					hash,
					size: Buffer.byteLength(msgStr, 'utf8'),
				}
			);
			await sleep(100);
		}
		await wait(MESSAGE_STORE_TIMEOUT);
	};

	beforeEach(async () => {
		v = new Validator(new Runtime());

		v['cacheProvider'] = new TestCacheProvider();

		// mock storage provider
		storageProvider = new TestNormalStorageProvider();
		jest
			.spyOn(Validator, 'storageProviderFactory')
			.mockImplementation(() => storageProvider);

		// mock compression
		compression = new TestNormalCompression();
		jest
			.spyOn(Validator, 'compressionFactory')
			.mockImplementation(() => compression);

		// mock archiveDebugBundle
		v['archiveDebugBundle'] = jest.fn();

		// mock process.exit
		processExit = jest.fn<never, never>();
		process.exit = processExit;

		// mock setTimeout
		setTimeoutMock = jest.fn().mockImplementation(
			(
				callback: (args: void) => void
				// ms?: number | undefined
			): NodeJS.Timeout => {
				callback();
				return null as any;
			}
		);
		global.setTimeout = setTimeoutMock as any;

		// // mock logger
		// v.logger = new Logger();

		// v.logger.info = jest.fn();
		// v.logger.debug = jest.fn();
		// v.logger.warn = jest.fn();
		// v.logger.error = jest.fn();

		v['poolId'] = 0;
		v['staker'] = 'test_staker';

		v['rpc'] = ['http://0.0.0.0:26657'];
		v.client = [client()];

		v['rest'] = ['http://0.0.0.0:1317'];
		v.lcd = [lcd()];

		v['continueRound'] = jest
			.fn()
			.mockReturnValueOnce(true)
			.mockReturnValue(false);

		v['waitForCacheContinuation'] = jest.fn();

		setupMetrics.call(v);

		publisherClient = new LogStoreClient({
			...CONFIG_TEST,
			auth: {
				privateKey: await fetchPrivateKeyWithGas(),
			},
		});

		// systemStream = await createTestStream(publisherClient, module, {
		// 	partitions: 1,
		// });
		// queryStream = await createTestStream(publisherClient, module, {
		// 	partitions: 1,
		// });
		// await publisherClient.addStreamToLogStore(systemStream.id, STAKE_AMOUNT);
		// await publisherClient.addStreamToLogStore(queryStream.id, STAKE_AMOUNT);

		// v.systemStreamId = systemStream.id;
		// v.queryStreamId = queryStream.id;
	}, TIMEOUT);

	afterEach(async () => {
		await publisherClient?.destroy();
	}, TIMEOUT);

	test('start runtime with a pool which is in genesis state', async () => {
		// ARRANGE
		v.pool = {
			...genesis_pool,
		} as any;

		// ACT
		await runCache.call(v);

		// Populate the Listener Cache
		await publishQueryMessages(15);
		await publishStorageMessages(15);

		const maxBundleSize = parseInt(v.pool.data.max_bundle_size, 10);
		for (let i = 0; i < maxBundleSize; i++) {
			const cacheVal = v['cacheProvider'].get(`${i}`);

			console.log(cacheVal);
		}
	});
});
