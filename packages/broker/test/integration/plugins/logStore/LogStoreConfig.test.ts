import { LogStoreClient } from '@concertodao/logstore-client';
import { Tracker } from '@streamr/network-tracker';
import { StreamMessage } from '@streamr/protocol';
import {
	fastWallet,
	fetchPrivateKeyWithGas,
	KeyServer,
} from '@streamr/test-utils';
import { waitForCondition } from '@streamr/utils';
import cassandra, { Client } from 'cassandra-driver';
import { Wallet } from 'ethers';
import { Broker as StreamrBroker } from 'streamr-broker';
import StreamrClient, { Stream } from 'streamr-client';

import { Broker } from '../../../../src/broker';
import {
	createLogStoreClient,
	createStreamrClient,
	createTestStream,
	startLogStoreBroker,
	startStreamrBroker,
	startTestTracker,
	STREAMR_DOCKER_DEV_HOST,
} from '../../../utils';

jest.setTimeout(30000);

const contactPoints = [STREAMR_DOCKER_DEV_HOST];
const localDataCenter = 'datacenter1';
const keyspace = 'logstore_dev';

const HTTP_PORT = 17770;
const TRACKER_PORT = 17772;

describe('LogStoreConfig', () => {
	let cassandraClient: Client;
	let tracker: Tracker;
	let logStoreBroker: Broker;
	let logStoreClient: LogStoreClient;
	let streamrBroker: StreamrBroker;
	let streamrClient: StreamrClient;
	let stream: Stream;
	let publisherAccount: Wallet;
	let logStoreClientAccount: Wallet;
	let logStoreBrokerAccount: Wallet;
	let streamrBrokerAccount: Wallet;

	beforeAll(async () => {
		publisherAccount = new Wallet(await fetchPrivateKeyWithGas());
		logStoreBrokerAccount = new Wallet(await fetchPrivateKeyWithGas());
		streamrBrokerAccount = fastWallet();
		logStoreClientAccount = fastWallet();
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
		stream = await createTestStream(streamrClient, module);

		await logStoreClient.addStreamToLogStore(stream.id);

		const publishMessage = await streamrClient.publish(stream.id, {
			foo: 'bar',
		});
		await waitForCondition(async () => {
			const result = await cassandraClient.execute(
				'SELECT COUNT(*) FROM stream_data WHERE stream_id = ? ALLOW FILTERING',
				[stream.id]
			);
			return result.first().count > 0;
		}, 10000);
		const result = await cassandraClient.execute(
			'SELECT * FROM stream_data WHERE stream_id = ? ALLOW FILTERING',
			[stream.id]
		);
		const storeMessage = StreamMessage.deserialize(
			JSON.parse(result.first().payload.toString())
		);
		expect(storeMessage.signature).toEqual(publishMessage.signature);
	});
});
