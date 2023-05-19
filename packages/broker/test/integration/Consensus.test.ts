import {
	CONFIG_TEST,
	LogStoreClient,
	NodeMetadata,
	Stream,
	StreamPermission,
} from '@concertodao/logstore-client';
import {
	LogStoreManager,
	LogStoreNodeManager,
	LogStoreQueryManager,
} from '@concertodao/logstore-contracts';
import {
	getNodeManagerContract,
	getQueryManagerContract,
	getStoreManagerContract,
	prepareStakeForNodeManager,
	prepareStakeForQueryManager,
	prepareStakeForStoreManager,
} from '@concertodao/logstore-shared';
import { Tracker } from '@streamr/network-tracker';
import { fetchPrivateKeyWithGas, KeyServer } from '@streamr/test-utils';
import { waitForCondition } from '@streamr/utils';
import { providers, Wallet } from 'ethers';

import { Broker } from '../../src/broker';
import {
	createLogStoreClient,
	createTestStream,
	sleep,
	startLogStoreBroker,
	startTestTracker,
} from '../utils';

jest.setTimeout(60000);

const STAKE_AMOUNT = BigInt('1000000000000000000');
const TRACKER_PORT = 17772;
const BROKERS_NUM = 3;

describe('Consensus', () => {
	const provider = new providers.JsonRpcProvider(
		CONFIG_TEST.contracts?.streamRegistryChainRPCs?.rpcs[0].url,
		CONFIG_TEST.contracts?.streamRegistryChainRPCs?.chainId
	);

	// Accounts
	const logStoreBrokerAccounts: Wallet[] = [];
	let publisherAccount: Wallet;
	let storeOwnerAccount: Wallet;
	let storeConsumerAccount: Wallet;

	// Broker
	const logStoreBrokers: Broker[] = [];

	// Clients
	let publisherClient: LogStoreClient;
	let consumerClient: LogStoreClient;

	// Contracts
	const nodeManagers: LogStoreNodeManager[] = [];
	let storeManager: LogStoreManager;
	let queryManager: LogStoreQueryManager;

	let tracker: Tracker;
	let testStream: Stream;

	beforeAll(async () => {
		for (let i = 0; i < BROKERS_NUM; i++) {
			const account = new Wallet(await fetchPrivateKeyWithGas(), provider);
			logStoreBrokerAccounts.push(account);
			nodeManagers.push(await getNodeManagerContract(account));
		}

		// Accounts
		publisherAccount = new Wallet(await fetchPrivateKeyWithGas(), provider);
		storeOwnerAccount = new Wallet(await fetchPrivateKeyWithGas(), provider);
		storeConsumerAccount = new Wallet(await fetchPrivateKeyWithGas(), provider);

		// Contracts
		storeManager = await getStoreManagerContract(storeOwnerAccount);
		queryManager = await getQueryManagerContract(storeConsumerAccount);
	});

	afterAll(async () => {
		// TODO: Setup global tear-down
		await KeyServer.stopIfRunning();
	});

	beforeEach(async () => {
		tracker = await startTestTracker(TRACKER_PORT);

		for (let i = 0; i < BROKERS_NUM; i++) {
			const nodeMetadata: NodeMetadata = {
				http: `http://127.0.0.1:717${i + 1}`,
			};

			await prepareStakeForNodeManager(logStoreBrokerAccounts[i], STAKE_AMOUNT);
			(
				await nodeManagers[i].join(STAKE_AMOUNT, JSON.stringify(nodeMetadata))
			).wait();
		}

		// Wait for the granted permissions to the system stream
		await sleep(5000);
		for (let i = 0; i < BROKERS_NUM; i++) {
			logStoreBrokers.push(
				await startLogStoreBroker({
					privateKey: logStoreBrokerAccounts[i].privateKey,
					trackerPort: TRACKER_PORT,
					keyspace: `logstore_test_0${i + 1}`,
					httpServerPort: 7171 + i,
				})
			);
		}
		publisherClient = await createLogStoreClient(
			tracker,
			publisherAccount.privateKey
		);

		consumerClient = await createLogStoreClient(
			tracker,
			storeConsumerAccount.privateKey
		);

		testStream = await createTestStream(publisherClient, module);

		await prepareStakeForStoreManager(storeOwnerAccount, STAKE_AMOUNT);
		(await storeManager.stake(testStream.id, STAKE_AMOUNT)).wait();

		await prepareStakeForQueryManager(storeConsumerAccount, STAKE_AMOUNT);
		(await queryManager.stake(STAKE_AMOUNT)).wait();
	});

	afterEach(async () => {
		await publisherClient.destroy();
		await consumerClient.destroy();
		await tracker?.stop();
		for (let i = 0; i < BROKERS_NUM; i++) {
			await logStoreBrokers[i]?.stop();
			(await nodeManagers[i].leave()).wait();
		}
	});

	// TODO: Add explanation here
	it('broker nodes reach consensus', async () => {
		// TODO: the consumer must have permission to subscribe to the stream or the strem have to be public
		await testStream.grantPermissions({
			user: await consumerClient.getAddress(),
			permissions: [StreamPermission.SUBSCRIBE],
		});
		// await testStream.grantPermissions({
		// 	public: true,
		// 	permissions: [StreamPermission.SUBSCRIBE],
		// });

		await publisherClient.publish(testStream.id, {
			foo: 'bar 1',
		});
		await publisherClient.publish(testStream.id, {
			foo: 'bar 2',
		});
		await publisherClient.publish(testStream.id, {
			foo: 'bar 3',
		});

		await sleep(5000);

		const messages = [];

		const messageStream = await consumerClient.query(testStream.id, {
			last: 2,
		});

		for await (const message of messageStream) {
			const { content } = message;
			messages.push({ content });
		}

		await waitForCondition(async () => {
			return messages.length === 2;
		});
	});
});
