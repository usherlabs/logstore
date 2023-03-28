import { Tracker } from '@streamr/network-tracker';
import { fetchPrivateKeyWithGas, KeyServer } from '@streamr/test-utils';
import { toEthereumAddress } from '@streamr/utils';
import { Wallet } from 'ethers';

import { Broker } from '../../../../src/broker';
import { startLogStoreBroker, startTestTracker } from '../../../utils';

const trackerPort = 12503;

describe('LogStoreNode', () => {
	let tracker: Tracker;
	let logStoreBroker: Broker;
	let logStoreBrokerAccount: Wallet;

	beforeAll(async () => {
		tracker = await startTestTracker(trackerPort);
	});

	beforeAll(async () => {
		logStoreBrokerAccount = new Wallet(await fetchPrivateKeyWithGas());
		logStoreBroker = await startLogStoreBroker({
			privateKey: logStoreBrokerAccount.privateKey,
			trackerPort: 1234,
			enableCassandra: true,
		});
	}, 30 * 1000);

	afterAll(async () => {
		await tracker?.stop();
		await logStoreBroker?.stop();
		// TODO: Setup global tear-down
		await KeyServer.stopIfRunning();
	});

	it('has node id same as address', async () => {
		expect((await logStoreBroker.getNode()).getNodeId()).toEqual(
			toEthereumAddress(logStoreBrokerAccount.address)
		);
	});
});
