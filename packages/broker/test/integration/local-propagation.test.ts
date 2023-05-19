import {
	LogStoreClient,
	Stream,
	StreamPermission,
} from '@concertodao/logstore-client';
import { Wallet } from '@ethersproject/wallet';
import { Tracker } from '@streamr/network-tracker';
import { fetchPrivateKeyWithGas } from '@streamr/test-utils';
import { wait, waitForCondition } from '@streamr/utils';

import { Broker } from '../../src/broker';
import {
	createLogStoreClient,
	createTestStream,
	startLogStoreBroker,
	startTestTracker,
} from '../utils';

jest.setTimeout(30000);

const trackerPort = 17711;

describe('local propagation', () => {
	let tracker: Tracker;
	let broker: Broker;
	let privateKey: string;
	let client1: LogStoreClient;
	let client2: LogStoreClient;
	let freshStream: Stream;
	let freshStreamId: string;
	let brokerWallet: Wallet;

	beforeAll(async () => {
		privateKey = await fetchPrivateKeyWithGas();
		tracker = await startTestTracker(trackerPort);
		brokerWallet = new Wallet(await fetchPrivateKeyWithGas());

		broker = await startLogStoreBroker({
			privateKey: brokerWallet.privateKey,
			trackerPort,
		});

		client1 = await createLogStoreClient(tracker, privateKey);
		client2 = await createLogStoreClient(tracker, privateKey);
	});

	beforeEach(async () => {
		freshStream = await createTestStream(client1, module);
		freshStreamId = freshStream.id;
		await freshStream.grantPermissions({
			permissions: [StreamPermission.PUBLISH],
			user: brokerWallet.address,
		});

		await wait(3000);
	});

	afterAll(async () => {
		await Promise.all([
			tracker.stop(),
			client1.destroy(),
			client2.destroy(),
			broker.stop(),
		]);
	});

	test('local propagation using LogStoreClients', async () => {
		const client1Messages: any[] = [];
		const client2Messages: any[] = [];

		await Promise.all([
			client1.subscribe(
				{
					stream: freshStreamId,
				},
				(message) => {
					client1Messages.push(message);
				}
			),
			client2.subscribe(
				{
					stream: freshStreamId,
				},
				(message) => {
					client2Messages.push(message);
				}
			),
		]);

		await client1.publish(freshStreamId, {
			key: 1,
		});
		await client1.publish(freshStreamId, {
			key: 2,
		});
		await client1.publish(freshStreamId, {
			key: 3,
		});

		await waitForCondition(() => client2Messages.length === 3);
		await waitForCondition(() => client1Messages.length === 3);

		expect(client1Messages).toEqual([
			{
				key: 1,
			},
			{
				key: 2,
			},
			{
				key: 3,
			},
		]);

		expect(client2Messages).toEqual([
			{
				key: 1,
			},
			{
				key: 2,
			},
			{
				key: 3,
			},
		]);
	});
});
