import { CONFIG_TEST, LogStoreClient } from '@concertodao/logstore-client';
import {
	ProofOfMessageStored,
	QueryRequest,
	QueryResponse,
	QueryType,
	SystemMessage,
	SystemMessageType,
} from '@concertodao/logstore-protocol';
import {
	getNodeManagerContract,
	prepareStakeForNodeManager,
} from '@concertodao/logstore-shared';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import {
	ICacheProvider,
	ICompression,
	IStorageProvider,
} from '@kyvejs/protocol';
import { TestCacheProvider } from '@kyvejs/protocol/test/mocks/cache.mock';
import { client } from '@kyvejs/protocol/test/mocks/client.mock';
import { TestNormalCompression } from '@kyvejs/protocol/test/mocks/compression.mock';
import { lcd } from '@kyvejs/protocol/test/mocks/lcd.mock';
import { TestNormalStorageProvider } from '@kyvejs/protocol/test/mocks/storageProvider.mock';
import { fastPrivateKey } from '@streamr/test-utils';
import { wait } from '@streamr/utils';
import { ethers } from 'ethers';
import { range } from 'lodash';
import path from 'path';
import { register } from 'prom-client';
import { ILogObject, Logger } from 'tslog';
import { fromString } from 'uint8arrays';

import Runtime from '../../src/runtime';
import { Arweave } from '../../src/utils/arweave';
import { StakeToken } from '../../src/utils/stake-token';
import Validator from '../../src/validator';

const {
	DISABLE_DEBUG_LOGS,
	KYVE_DEV_HOST = 'localhost',
	STREAMR_DOCKER_DEV_HOST = 'localhost',
} = process.env;
export const BROKER_NODE_PRIVATE_KEY =
	process.env.BROKER_NODE_PRIVATE_KEY ||
	('0xb1abdb742d3924a45b0a54f780f0f21b9d9283b231a0a0b35ce5e455fa5375e7' as const);
const MESSAGE_STORE_TIMEOUT = 9 * 1000;
function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(() => resolve(true), ms));
}

let processExit: jest.Mock<never, never>;

let v: Validator;
let storageProvider: IStorageProvider;
let cacheProvider: ICacheProvider;
let compression: ICompression;
let publisherClient: LogStoreClient;

const VERSION = 1;

export async function setupTests() {
	const evmPrivateKey = fastPrivateKey();
	process.env.EVM_PRIVATE_KEY = evmPrivateKey;

	v = new Validator(new Runtime());

	// mock cache provider
	cacheProvider = new TestCacheProvider();
	jest
		.spyOn(Validator, 'cacheProviderFactory')
		.mockImplementation(() => cacheProvider);

	v['cacheProvider'] = cacheProvider;

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

	// // mock archiveDebugBundle
	// v['archiveDebugBundle'] = jest.fn();

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

	// Ensure that all prom calls are setup
	await v['setupMetrics']();

	const provider = new JsonRpcProvider(
		`http://${STREAMR_DOCKER_DEV_HOST}:8546` // tunnel to remote server
	);
	await provider.ready;
	const signer = new Wallet(BROKER_NODE_PRIVATE_KEY, provider);
	const nodeManagerContract = await getNodeManagerContract(signer);
	const nodeAddresses = await nodeManagerContract.nodeAddresses();
	const nodeExists = nodeAddresses.includes(signer.address);
	const isStaked = await nodeManagerContract.isStaked(signer.address);

	console.log(`${signer.address} ${nodeExists ? 'exists' : 'DOES NOT exist'}!`);
	console.log(`${signer.address} is ${isStaked ? 'already' : 'NOT'} staked!`);

	if (!isStaked) {
		const stakeRequiredAmount = await nodeManagerContract.stakeRequiredAmount();
		const stakeAmount = await prepareStakeForNodeManager(
			signer,
			stakeRequiredAmount.toBigInt(),
			false
		);
		if (nodeExists) {
			console.log(
				`${
					signer.address
				} will stake and delegate with ${stakeAmount.toString()}`
			);
			await (
				await nodeManagerContract.stakeAndDelegate(stakeAmount, signer.address)
			).wait();
		} else {
			console.log(`${signer.address} will join with ${stakeAmount.toString()}`);
			await (
				await nodeManagerContract.join(stakeAmount, '{ "hello": "world" }')
			).wait();
		}
	}
	console.log('Provider Latest Block: ', await provider.getBlockNumber());

	publisherClient = new LogStoreClient({
		...CONFIG_TEST,
		auth: {
			privateKey: BROKER_NODE_PRIVATE_KEY,
		},
	});

	// ? StreamrDevNet uses a Stake token that cannot be found in Redstone, so this will always yield stake token value of 0.01
	// Mock getPrice in Arweave and StakeToken util classes
	jest.spyOn(StakeToken.prototype, 'getPrice').mockImplementation(async () => {
		return 0.01; // return a constant for dev tokens in test.
	});
	jest
		.spyOn(Arweave, 'getPrice')
		.mockImplementation(async (byteSize: number) => {
			// const avgWinstonPerByte = 189781180 / 100000 // as per 13th of May 2023 from https://arweave.net/price/100000
			const constantWinstonPerByte = 2000; // where 200000000 is required for 100000 bytes
			return byteSize * constantWinstonPerByte;
		});

	return v;
}

export async function cleanupTests() {
	// reset prometheus
	register.clear();

	await publisherClient?.destroy();
	if (v.listener) {
		await v.listener.stop();
	}
}

export const publishStorageMessages = async (numOfMessages: number) => {
	const { systemStreamId } = v['runtime'].config;
	try {
		const sourceStreamId = systemStreamId.replace('/system', '/test');
		for (const idx of range(numOfMessages)) {
			const msg = { messageNo: idx };
			const msgStr = JSON.stringify(msg);
			const size = Buffer.byteLength(msgStr, 'utf8');
			const hash = ethers.utils.keccak256(
				fromString(sourceStreamId + msgStr + size)
			);
			console.log(`Publishing storage message:`, msg, { hash, size });

			const content = {
				id: sourceStreamId,
				hash,
				size,
			};
			const serializer = SystemMessage.getSerializer(
				VERSION,
				SystemMessageType.ProofOfMessageStored
			);

			const serialisedStorageMessage = serializer.toArray(
				new ProofOfMessageStored({
					version: VERSION,
					streamId: content.id,
					partition: 0,
					timestamp: +new Date(),
					sequenceNumber: 0,
					size: content.size,
					hash: content.hash,
				})
			);

			await publisherClient.publish(
				{
					id: systemStreamId,
					partition: 0,
				},
				serialisedStorageMessage
			);
			await sleep(100);
		}
		await wait(MESSAGE_STORE_TIMEOUT);
	} catch (e) {
		console.log(`Cannot publish message to storage stream`);
		console.error(e);
	}
};

export const publishQueryMessages = async (
	numOfMessages: number,
	brokerNodeCount: number
) => {
	const { systemStreamId } = v['runtime'].config;
	const sourceStreamId = systemStreamId.replace('/system', '/test');
	for (const idx of range(numOfMessages)) {
		const query = { from: { timestamp: 1 }, to: { timestamp: 2 } };
		const consumer = '0x00000000000';
		const msg = { messageNo: idx };
		const queryStr = JSON.stringify(query);
		const msgStr = JSON.stringify(msg);
		const size = Buffer.byteLength(msgStr, 'utf8');
		const hash = ethers.utils.keccak256(
			fromString(sourceStreamId + queryStr + consumer + msgStr + size)
		);

		// create one Query request, send it across the stream
		const content = {
			id: sourceStreamId,
			query,
			consumer,
			hash,
			size,
		};
		// publish single request to stream
		const requestSerializer = SystemMessage.getSerializer(
			VERSION,
			SystemMessageType.QueryRequest
		);
		const serialisedRequest = requestSerializer.toArray(
			new QueryRequest({
				requestId: idx,
				consumerId: content.consumer,
				streamId: content.id,
				partition: 0,
				queryType: QueryType.Range,
				queryOptions: content.query,
			})
		);
		await publisherClient.publish(
			{
				id: systemStreamId,
				partition: 0,
			},
			serialisedRequest
		);

		// publish multiple responses to imitate multiple broker nodes responsible
		for (const jdx of range(brokerNodeCount)) {
			// add random wait to account for minor delay/latency
			await sleep(jdx * 100);
			// simulate and publish a response to this request
			const responseSerializer = SystemMessage.getSerializer(
				VERSION,
				SystemMessageType.QueryResponse
			);
			const serializedResponse = responseSerializer.toArray(
				new QueryResponse({
					requestId: idx,
					size: content.size,
					hash: content.hash,
					signature: `test_sig_of_broker_${jdx}`,
				})
			);

			await publisherClient.publish(
				{
					id: systemStreamId,
					partition: 0,
				},
				serializedResponse
			);
		}
	}
	await wait(MESSAGE_STORE_TIMEOUT);
};
