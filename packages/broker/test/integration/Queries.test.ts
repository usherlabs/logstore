import { CONFIG_TEST, LogStoreClient } from '@concertodao/logstore-client';
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
import StreamrClient, { Stream, StreamPermission } from 'streamr-client';

import { Broker } from '../../src/broker';
import {
	createLogStoreClient,
	createStreamrClient,
	createTestStream,
	sleep,
	startLogStoreBroker,
	startTestTracker,
} from '../utils';

jest.setTimeout(60000);

const STAKE_AMOUNT = BigInt('1000000000000000000');
const TRACKER_PORT = 17772;

describe('Queries', () => {
	const provider = new providers.JsonRpcProvider(
		CONFIG_TEST.contracts?.streamRegistryChainRPCs?.rpcs[0].url,
		CONFIG_TEST.contracts?.streamRegistryChainRPCs?.chainId
	);

	// Accounts
	let logStoreBrokerAccount: Wallet;
	let publisherAccount: Wallet;
	let storeOwnerAccount: Wallet;
	let storeConsumerAccount: Wallet;

	// Broker
	let logStoreBroker: Broker;

	// Clients
	let publisherClient: StreamrClient;
	let consumerClient: LogStoreClient;

	// Contracts
	let nodeManager: LogStoreNodeManager;
	let storeManager: LogStoreManager;
	let queryManager: LogStoreQueryManager;

	let tracker: Tracker;
	let testStream: Stream;

	beforeAll(async () => {
		logStoreBrokerAccount = new Wallet(
			await fetchPrivateKeyWithGas(),
			provider
		);
		// Accounts
		publisherAccount = new Wallet(await fetchPrivateKeyWithGas(), provider);
		storeOwnerAccount = new Wallet(await fetchPrivateKeyWithGas(), provider);
		storeConsumerAccount = new Wallet(await fetchPrivateKeyWithGas(), provider);

		// Contracts
		nodeManager = await getNodeManagerContract(logStoreBrokerAccount);
		storeManager = await getStoreManagerContract(storeOwnerAccount);
		queryManager = await getQueryManagerContract(storeConsumerAccount);
	});

	afterAll(async () => {
		// TODO: Setup global tear-down
		await KeyServer.stopIfRunning();
	});

	beforeEach(async () => {
		tracker = await startTestTracker(TRACKER_PORT);

		await prepareStakeForNodeManager(logStoreBrokerAccount, STAKE_AMOUNT);
		(await nodeManager.join(STAKE_AMOUNT, 'http://127.0.0.1:7171')).wait();

		// Wait for the granted permissions to the system stream
		await sleep(5000);

		logStoreBroker = await startLogStoreBroker({
			privateKey: logStoreBrokerAccount.privateKey,
			trackerPort: TRACKER_PORT,
		});

		publisherClient = await createStreamrClient(
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
		await Promise.allSettled([
			logStoreBroker?.stop(),
			nodeManager.leave(),
			tracker?.stop(),
		]);
	});

	it('when client publishes a message, it is written to the store', async () => {
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
