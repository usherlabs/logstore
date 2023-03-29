import { LogStoreClient } from '@concertodao/logstore-client';
import { Tracker } from '@streamr/network-tracker';
import {
	fastWallet,
	fetchPrivateKeyWithGas,
	KeyServer,
} from '@streamr/test-utils';
import { waitForCondition } from '@streamr/utils';
import cassandra, { Client } from 'cassandra-driver';
import { BigNumber, Wallet } from 'ethers';
import { Broker as StreamrBroker } from 'streamr-broker';
import StreamrClient, { Stream, StreamPermission } from 'streamr-client';

import { Broker } from '../../src/broker';
import {
	createLogStoreClient,
	createStreamrClient,
	createTestStream,
	sleep,
	startLogStoreBroker,
	startStreamrBroker,
	startTestTracker,
	STREAMR_DOCKER_DEV_HOST,
} from '../utils';

jest.setTimeout(60000);

const contactPoints = [STREAMR_DOCKER_DEV_HOST];
const localDataCenter = 'datacenter1';
const keyspace = 'logstore_dev';

const STAKE_AMOUNT = BigNumber.from('100000000000000000');
const HTTP_PORT = 17770;
const TRACKER_PORT = 17772;

// TODO: See analogous test in Streamr repo packages/client/test/end-to-end/resend.test.ts
describe('Queries', () => {
	let cassandraClient: Client;
	let tracker: Tracker;
	let logStoreBroker: Broker;
	let logStoreClient: LogStoreClient;
	let streamrBroker: StreamrBroker;
	let streamrClient: StreamrClient;
	let testStream: Stream;
	let publisherAccount: Wallet;
	let logStoreBrokerAccount: Wallet;
	let logStoreClientAccount: Wallet;
	let streamrBrokerAccount: Wallet;

	beforeAll(async () => {
		publisherAccount = new Wallet(await fetchPrivateKeyWithGas());
		logStoreBrokerAccount = fastWallet();
		streamrBrokerAccount = fastWallet();
		logStoreClientAccount = new Wallet(await fetchPrivateKeyWithGas());
		cassandraClient = new cassandra.Client({
			contactPoints,
			localDataCenter,
			keyspace,
		});
	});

	afterAll(async () => {
		await cassandraClient?.shutdown();
		// TODO: Setup global tear-down
		await KeyServer.stopIfRunning();
	});

	beforeEach(async () => {
		tracker = await startTestTracker(TRACKER_PORT);

		logStoreBroker = await startLogStoreBroker({
			privateKey: logStoreBrokerAccount.privateKey,
			trackerPort: TRACKER_PORT,
			enableCassandra: true,
		});

		logStoreClient = await createLogStoreClient(
			tracker,
			logStoreClientAccount.privateKey
		);

		streamrBroker = await startStreamrBroker({
			privateKey: streamrBrokerAccount.privateKey,
			trackerPort: TRACKER_PORT,
		});

		streamrClient = await createStreamrClient(
			tracker,
			publisherAccount.privateKey
		);
	});

	afterEach(async () => {
		await streamrClient.destroy();
		await logStoreClient.destroy();
		await Promise.allSettled([
			logStoreBroker?.stop(),
			streamrBroker?.stop(),
			tracker?.stop(),
		]);
	});

	it('when client publishes a message, it is written to the store', async () => {
		testStream = await createTestStream(streamrClient, module);

		// TODO: Currently works only for unencrypted messages (public)
		streamrClient.setPermissions({
			streamId: testStream.id,
			assignments: [
				{ permissions: [StreamPermission.SUBSCRIBE], public: true },
			],
		});

		await logStoreClient.addStreamToLogStore(testStream.id, STAKE_AMOUNT);
		await streamrClient.publish(testStream.id, {
			foo: 'bar 1',
		});
		await streamrClient.publish(testStream.id, {
			foo: 'bar 2',
		});
		await streamrClient.publish(testStream.id, {
			foo: 'bar 3',
		});

		// TODO: Research why the delay is here
		await sleep(5000);

		const messages = [];

		const messageStream = await logStoreClient.query(testStream.id, {
			last: 2,
		});

		for await (const message of messageStream) {
			const { content } = message;
			console.log(content);
			messages.push({ content });
		}

		await waitForCondition(async () => {
			return messages.length === 2;
		});
	});
});
