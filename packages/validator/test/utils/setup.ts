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

import Listener from '../../src/listener';
import Runtime from '../../src/runtime';
import Validator from '../../src/validator';

const {
	DISABLE_DEBUG_LOGS,
	KYVE_DEV_HOST = 'localhost',
	STREAMR_DOCKER_DEV_HOST = 'localhost',
} = process.env;
const BROKER_NODE_PRIVATE_KEY =
	'0xb1abdb742d3924a45b0a54f780f0f21b9d9283b231a0a0b35ce5e455fa5375e7' as const;
const MESSAGE_STORE_TIMEOUT = 9 * 1000;
function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(() => resolve(true), ms));
}

let processExit: jest.Mock<never, never>;

// let cacheProvider: ICacheProvider;
let v: Validator;
let storageProvider: IStorageProvider;
let compression: ICompression;
let publisherClient: LogStoreClient;

export async function setupTests() {
	const evmPrivateKey = await fastPrivateKey();
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

	v['rpc'] = [`http://${KYVE_DEV_HOST}:26657`];
	v.client = [client()];

	v['rest'] = [`http://${KYVE_DEV_HOST}:1317`];
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
		`http://${STREAMR_DOCKER_DEV_HOST}:8546` // tunnel to remote server
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

	// ? StreamrDevNet uses a Stake token that cannot be found in Redstone, so this will always yield stake token value of 0.01
	// jest.spyOn(redstone, 'getPrice').mockImplementation((symbols: string[], opts?: GetPriceOptions) => Promise<{ [token: string]: PriceData; }>);

	return v;
}

export async function cleanupTests() {
	// reset prometheus
	register.clear();

	await publisherClient?.destroy();

	await v.listener.stop();
}

export const publishStorageMessages = async (numOfMessages: number) => {
	try {
		const sourceStreamId = v.systemStreamId.replace('/system', '/test');
		for (const idx of range(numOfMessages)) {
			const msg = { messageNo: idx };
			const msgStr = JSON.stringify(msg);
			const size = Buffer.byteLength(msgStr, 'utf8');
			const hash = ethers.keccak256(fromString(sourceStreamId + msgStr + size));
			console.log(`Publishing storage message:`, msg, { hash, size });
			await publisherClient.publish(
				{
					id: v.systemStreamId,
					partition: 0,
				},
				{
					id: sourceStreamId,
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

export const publishQueryMessages = async (numOfMessages: number) => {
	const sourceStreamId = v.systemStreamId.replace('/system', '/test');
	for (const idx of range(numOfMessages)) {
		const query = { from: { timestamp: 0 }, to: { timestamp: 0 } };
		const consumer = '0x00000000000';
		const msg = { messageNo: idx };
		const queryStr = JSON.stringify(query);
		const msgStr = JSON.stringify(msg);
		const size = Buffer.byteLength(msgStr, 'utf8');
		const hash = ethers.keccak256(
			fromString(sourceStreamId + queryStr + consumer + msgStr + size)
		);
		await publisherClient.publish(
			{
				id: v.systemStreamId,
				partition: 0,
			},
			{
				id: sourceStreamId,
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
