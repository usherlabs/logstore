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
import 'reflect-metadata';
import { Broker as StreamrBroker } from 'streamr-broker';
import StreamrClient, { Stream } from 'streamr-client';
import { container } from 'tsyringe';

import { Broker } from '../../../../src/broker';
import { LogStoreRegistry } from '../../../../src/registry/LogStoreRegistry';
import {
	createClient,
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
	let streamrBroker: StreamrBroker;
	let client: StreamrClient;
	let stream: Stream;
	let publisherAccount: Wallet;
	let logStoreBrokerAccount: Wallet;
	let streamrBrokerAccount: Wallet;

	beforeAll(async () => {
		publisherAccount = new Wallet(await fetchPrivateKeyWithGas());
		logStoreBrokerAccount = new Wallet(await fetchPrivateKeyWithGas());
		streamrBrokerAccount = fastWallet();
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

		logStoreBroker = await startLogStoreBroker(
			logStoreBrokerAccount.privateKey,
			HTTP_PORT,
			TRACKER_PORT
		);

		streamrBroker = await startStreamrBroker({
			privateKey: streamrBrokerAccount.privateKey,
			trackerPort: TRACKER_PORT,
			enableCassandra: false,
		});

		client = await createClient(tracker, publisherAccount.privateKey);
	});

	afterEach(async () => {
		await client.destroy();
		await Promise.allSettled([
			logStoreBroker?.stop(),
			streamrBroker?.stop(),
			tracker?.stop(),
		]);
	});

	it('when client publishes a message, it is written to the store', async () => {
		stream = await createTestStream(client, module);

		const logStoreRegistry =
			container.resolve<LogStoreRegistry>(LogStoreRegistry);
		await logStoreRegistry.addToStorageNode(stream.id);
		// await logStoreRegistry.stake(
		// 	stream.id
		// 	// toEthereumAddress((await logStoreBroker.getNode()).getNodeId())
		// );
		// await stream.addToStorageNode(storageNodeAccount.address);

		const publishMessage = await client.publish(stream.id, {
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
