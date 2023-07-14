import { bundleToBytes, bytesToBundle, DataItem } from '@kyvejs/protocol';
import { Logger } from 'tslog';

import { compressionFactory } from '../src/reactors/compression';
import { Slogger } from '../src/utils/slogger';

const logger = new Logger();
Slogger.register(logger);

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

messages[messages.length - 1].value.r = report;

const compression = compressionFactory();

(async () => {
	const res = await compression.compress(bundleToBytes(messages));

	const res2 = await compression.decompress(res);

	const dBundle = bytesToBundle(res2);

	console.log(dBundle);
})();
