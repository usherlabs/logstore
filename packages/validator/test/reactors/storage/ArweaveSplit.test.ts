import { bundleToBytes, bytesToBundle, DataItem } from '@kyvejs/protocol';
import { BigNumber } from 'ethers';
import * as fs from 'fs';
import path from 'path';
import { Logger } from 'tslog';

import { compressionFactory } from '../../../src/reactors/compression';
import { storageProviderFactory } from '../../../src/reactors/storageProviders';
import { Slogger } from '../../../src/utils/slogger';

const messages: DataItem[] = [
	{ key: '0', value: { m: [] } },
	{ key: '1689263977', value: { m: [] } },
];
const report = {
	s: true,
	v: 1,
	id: '1689263977',
	height: 713,
	treasury: '0x00',
	streams: [],
	consumers: [],
	nodes: {},
	delegates: {},
	events: { queries: [], storage: [] },
};

/**
 * For this to work, NODE_TLS_REJECT_UNAUTHORIZED=0 is set on jest.config.js file
 * to run before tests instantiation. Otherwise, if it is set after tests instantiation,
 * it won't work.
 */
describe('Reactors - Storage: ArweaveSplit', () => {
	const filepath = path.join(
		__dirname,
		'../../../../../dev-network/assets/arweave/storage-1.json'
	);
	const arweaveKeyFile = fs.readFileSync(filepath, 'utf8');

	const storageProvider = storageProviderFactory(0, arweaveKeyFile);
	const compression = compressionFactory();

	beforeAll(() => {
		const logger = new Logger();
		Slogger.register(logger);
	});

	it('should access the arweave network', async () => {
		const res = await storageProvider.getBalance();

		const balance = BigNumber.from(res);
		expect(balance._isBigNumber).toBe(true);
		expect(balance.gte(0)).toBe(true);
	});

	it('should compress, upload, download & decompress raw data and evaluate the same values', async () => {
		const bundle = [...messages];
		bundle[bundle.length - 1].value.r = report;

		const compressed = await compression.compress(bundleToBytes(bundle));

		const tx = await storageProvider.saveBundle(compressed, [
			{ name: 'type', value: 'test' },
		]);

		const res = await storageProvider.retrieveBundle(tx.storageId, 90_000);

		const res2 = await compression.decompress(res.storageData);

		const dBundle = bytesToBundle(res2);

		expect(bundle).toEqual(dBundle);
	});
});
