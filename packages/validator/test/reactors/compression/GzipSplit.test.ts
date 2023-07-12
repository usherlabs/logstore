import { bundleToBytes, bytesToBundle, DataItem } from '@kyvejs/protocol';
import { Logger } from 'tslog';

import { compressionFactory } from '../../../src/reactors/compression';
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

describe('Reactors - Compression: GzipSplit', () => {
	const compression = compressionFactory();

	beforeAll(() => {
		const logger = new Logger();
		Slogger.register(logger);
	});

	it('should compress & decompress raw data and evaluate the same values', async () => {
		const bundle = [...messages];
		bundle[bundle.length - 1].value.r = report;

		const res = await compression.compress(bundleToBytes(bundle));

		const res2 = await compression.decompress(res);

		const dBundle = bytesToBundle(res2);

		expect(bundle).toEqual(dBundle);
	});
});
