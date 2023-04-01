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
import { TestNormalStorageProvider } from '@kyvejs/protocol/test/mocks/storageProvider.mock';
import { fastPrivateKey, fetchPrivateKeyWithGas } from '@streamr/test-utils';
import { wait } from '@streamr/utils';
import { ethers } from 'ethers';
import { range } from 'lodash';
import path from 'path';
import { register } from 'prom-client';
import { ILogObject, Logger } from 'tslog';
import { fromString } from 'uint8arrays';

import Runtime from '../src/runtime';
import Validator, { runCache, syncPoolConfig } from '../src/validator';
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

	// let cacheProvider: ICacheProvider;
	let storageProvider: IStorageProvider;
	let compression: ICompression;
	let publisherClient: LogStoreClient;

	let evmPrivateKey: string;

	const publishQueryMessages = async (numOfMessages: number) => {
		const signingKey = new ethers.SigningKey(`0x${evmPrivateKey}`);
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
		evmPrivateKey = await fastPrivateKey();
		process.env.EVM_PRIVATE_KEY = evmPrivateKey;

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

		// Streamr uses Timeout. It cannot be mocked.

		// mock logger -- Must be mocked to prevent undefined calls.
			jest
				.spyOn(Logger.prototype, 'info')
				.mockImplementation((...args: unknown[]) => {
					console.log(...args);
					return {} as ILogObject;
				});
			jest
				.spyOn(Logger.prototype, 'debug')
				.mockImplementation((...args: unknown[]) => {
					console.log(...args);
					return {} as ILogObject;
				});
			jest
				.spyOn(Logger.prototype, 'warn')
				.mockImplementation((...args: unknown[]) => {
					console.log(...args);
					return {} as ILogObject;
				});
			jest
				.spyOn(Logger.prototype, 'error')
				.mockImplementation((...args: unknown[]) => {
					console.log(...args);
					return {} as ILogObject;
				});
		});
		v.logger = new Logger();

		v['poolId'] = 0;
		v['staker'] = 'test_staker';

		v['rpc'] = ['http://0.0.0.0:26657'];
		v.client = [client()];

		v['rest'] = ['http://0.0.0.0:1317'];
		v.lcd = [lcd()];

		// Ensure the cache only runs in one cycle.
		v['continueRound'] = jest
			.fn()
			.mockReturnValueOnce(true)
			.mockReturnValue(false);

		v['waitForCacheContinuation'] = jest.fn();

		// Set home value
		v['home'] = path.join(__dirname, '../cache');

		// Ensure that all prom calls are setup
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
		// reset prometheus
		register.clear();

		await publisherClient?.destroy();
	});

	test('start runtime with a pool which is in genesis state', async () => {
		// ARRANGE
		v.pool = {
			...genesis_pool,
		} as any;

		// ACT
		await syncPoolConfig.call(v);
		await runCache.call(v);

		// Populate the Listener Cache
		await publishQueryMessages(15);
		await publishStorageMessages(15);

		const maxBundleSize = parseInt(v.pool.data.max_bundle_size, 10);
		for (let i = 0; i < maxBundleSize; i++) {
			try {
				const cacheVal = await v['cacheProvider'].get(`${i}`);
				console.log('#' + i, cacheVal);
			} catch (e) {
				// ...
			}
		}

		expect(true).toBe(true);
	});
});
