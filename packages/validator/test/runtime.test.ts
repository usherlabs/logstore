import { CONFIG_TEST, LogStoreClient } from '@concertodao/logstore-client';
import {
	getNodeManagerContract,
	prepareStakeForNodeManager,
} from '@concertodao/logstore-shared';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
// import { createTestStream } from '@concertodao/logstore-client/dist/test/test-utils/utils';
// import { BigNumber } from '@ethersproject/bignumber';
import {
	// ICacheProvider,
	ICompression,
	IStorageProvider,
} from '@kyvejs/protocol';
import { setupMetrics } from '@kyvejs/protocol/src/methods';
import { runCache } from '@kyvejs/protocol/src/methods';
import { TestCacheProvider } from '@kyvejs/protocol/test/mocks/cache.mock';
import { client } from '@kyvejs/protocol/test/mocks/client.mock';
import { TestNormalCompression } from '@kyvejs/protocol/test/mocks/compression.mock';
import { lcd } from '@kyvejs/protocol/test/mocks/lcd.mock';
import { TestNormalStorageProvider } from '@kyvejs/protocol/test/mocks/storageProvider.mock';
import { fastPrivateKey } from '@streamr/test-utils';
import { wait } from '@streamr/utils';
import { ethers } from 'ethers';
import { range } from 'lodash';
// import { MemoryLevel } from 'memory-level';
import path from 'path';
import { register } from 'prom-client';
import { ILogObject, Logger } from 'tslog';
import { fromString } from 'uint8arrays';

import Listener from '../src/listener';
import Runtime from '../src/runtime';
// import type { StreamrMessage } from '../src/types';
import Validator, { syncPoolConfig } from '../src/validator';
// import { TestListenerCacheProvider } from './mocks/cache.mock';
import { genesis_pool } from './mocks/constants';

// const STAKE_AMOUNT = BigNumber.from('100000000000000000');
const TIMEOUT = 90 * 1000;
const MESSAGE_STORE_TIMEOUT = 9 * 1000;
function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(() => resolve(true), ms));
}
const { DISABLE_DEBUG_LOGS } = process.env;
const BROKER_NODE_PRIVATE_KEY =
	'0xb1abdb742d3924a45b0a54f780f0f21b9d9283b231a0a0b35ce5e455fa5375e7' as const;

describe('Validator Runtime', () => {
	let v: Validator;

	let processExit: jest.Mock<never, never>;

	// let cacheProvider: ICacheProvider;
	let storageProvider: IStorageProvider;
	let compression: ICompression;
	let publisherClient: LogStoreClient;
	// const storeStreams: string[] = [];
	// let testSystemStream: Stream;

	let evmPrivateKey: string;

	const publishStorageMessages = async (numOfMessages: number) => {
		try {
			for (const idx of range(numOfMessages)) {
				const msg = { messageNo: idx };
				const msgStr = JSON.stringify(msg);
				const hash = ethers.keccak256(fromString(msgStr));
				const size = Buffer.byteLength(msgStr, 'utf8');
				console.log(`Publishing storage message:`, msg, { hash, size });
				await publisherClient.publish(
					{
						id: v.systemStreamId,
						partition: 0,
					},
					{
						hash,
						size,
					}
				);
				await sleep(100);
			}
			await wait(MESSAGE_STORE_TIMEOUT);
		} catch (e) {
			console.log(`Cannot publish message to storage stream`);
			console.error(e);
		}
	};
	const publishQueryMessages = async (numOfMessages: number) => {
		for (const idx of range(numOfMessages)) {
			const query = { from: { timestamp: 0 }, to: { timestamp: 0 } };
			const consumer = '0x00000000000';
			const msg = { messageNo: idx };
			const queryStr = JSON.stringify(query);
			const msgStr = JSON.stringify(msg);
			const size = Buffer.byteLength(msgStr, 'utf8');
			const hash = ethers.keccak256(
				fromString(queryStr + consumer + msgStr + size)
			);
			await publisherClient.publish(
				{
					id: v.systemStreamId, // TODO: Insufficient permissions to publish here.
					partition: 0,
				},
				{
					query,
					consumer,
					hash,
					size,
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
		if (DISABLE_DEBUG_LOGS !== 'true') {
			jest
				.spyOn(Logger.prototype, 'debug')
				.mockImplementation((...args: unknown[]) => {
					console.log(...args);
					return {} as ILogObject;
				});
		}
		jest
			.spyOn(Logger.prototype, 'info')
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

		v.logger = new Logger();
		if (DISABLE_DEBUG_LOGS === 'true') {
			v.logger.debug = jest.fn();
		}

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

		// jest.spyOn(Listener.prototype, 'createDb').mockImplementation(
		// 	() =>
		// 		new MemoryLevel<string, StreamrMessage>({
		// 			valueEncoding: 'json',
		// 		})
		// );
		v.listener = new Listener(v, v['home']);

		// Ensure that all prom calls are setup
		setupMetrics.call(v);

		const provider = new JsonRpcProvider(
			'http://localhost:8546' // tunnel to remote server
		);
		const signer = new Wallet(BROKER_NODE_PRIVATE_KEY, provider);
		const nodeManagerContract = await getNodeManagerContract(signer);
		const isStaked = await nodeManagerContract.isStaked(signer.address);
		if (!isStaked) {
			const stakeAmount = await prepareStakeForNodeManager(
				signer,
				10000,
				true,
				async () => true
			);
			await (
				await nodeManagerContract.join(stakeAmount, '{ "hello": "world" }')
			).wait();
		}

		publisherClient = new LogStoreClient({
			...CONFIG_TEST,
			auth: {
				privateKey: BROKER_NODE_PRIVATE_KEY,
			},
		});

		// Prepare the Log Store contract by creating some stores
		// testSystemStream = await createTestStream(publisherClient, module, {
		// 	partitions: 1,
		// });
		// await publisherClient.addStreamToLogStore(testSystemStream.id, STAKE_AMOUNT);

		// for (let i = 0; i < 3; i++) {
		// 	const stream = await createTestStream(publisherClient, module, {
		// 		partitions: 1,
		// 	});
		// 	await publisherClient.addStreamToLogStore(stream.id, STAKE_AMOUNT);
		// 	storeStreams.push(stream.id);
		// }

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

		// ARRANGE -- all tests share the same genesis pool data
		v.pool = {
			...genesis_pool,
		} as any;
	}, TIMEOUT);

	afterEach(async () => {
		// reset prometheus
		register.clear();

		await publisherClient?.destroy();
	});

	it(
		'should produce cache items',
		async () => {
			// ACT
			await syncPoolConfig.call(v);
			await v.listener.start();
			await publishStorageMessages(15);
			// await publishQueryMessages(15);
			await runCache.call(v);

			expect(v['cacheProvider'].put).toHaveBeenCalledTimes(3);

			const maxBundleSize = parseInt(v.pool.data.max_bundle_size, 10);
			for (let i = 0; i < maxBundleSize; i++) {
				try {
					const cacheVal = await v['cacheProvider'].get(`${i}`);
					console.log('Bundle Data Item #' + i, cacheVal);
				} catch (e) {
					// ...
				}
			}

			const db = v.listener.db();
			// Implement AsyncIterable into Mock
			for (const { key: k, value: v } of db.getRange()) {
				console.log('Message from Listener Cache: ', k, v);
			}

			expect(true).toBe(true);
		},
		TIMEOUT
	);

	// it('should listen for an then cache messages over logstore client', async () => {
	// 	// ACT
	// 	const contRound = v['continueRound'];
	// 	v['continueRound'] = jest.fn().mockReturnValue(false); // do not continue on actual kyve cache
	// 	await syncPoolConfig.call(v);
	// 	await runCache.call(v);
	// 	v['continueRound'] = contRound;

	// 	// Populate the Listener Cache
	// 	await publishQueryMessages(15);
	// 	await publishStorageMessages(15);

	// 	const db = await v.listener.db();
	// 	for await (const [k, v] of db.iterator()) {
	// 		console.log(k, v);
	// 	}

	// 	expect(true).toBe(true);
	// });
});
