import { runCache } from '@kyvejs/protocol/src/methods';

import { Item } from '../src/core/item';
import { Report } from '../src/core/report';
import Validator from '../src/validator';
import { reportPrefix } from './../src/utils/constants';
import { genesis_pool } from './mocks/constants';
import { cleanupTests, setupTests } from './utils/setup';

const TIMEOUT = 900 * 1000;

jest.mock('../src/core/item');
jest.mock('../src/core/report');

const mockReportValue = {
	id: 'HELLO_WORLD',
	height: 100,
	treasury: 0,
	streams: [],
	consumers: [],
	nodes: {},
	delegates: {},
	events: {
		queries: [],
		storage: [],
	},
};
const mockItemValue = ['hello', 'world'];

describe('Runtime', () => {
	let v: Validator;

	beforeEach(async () => {
		v = await setupTests();

		// This runtime test will execute the Item and Report Core DataItem generators, however, we're testing everything else here.
		jest.spyOn(Item.prototype, 'prepare').mockImplementation(jest.fn());
		jest.spyOn(Item.prototype, 'generate').mockImplementation(async () => {
			return mockItemValue;
		});
		jest.spyOn(Report.prototype, 'prepare').mockImplementation(jest.fn());
		jest.spyOn(Report.prototype, 'generate').mockImplementation(async () => {
			return mockReportValue;
		});
	}, TIMEOUT);

	afterEach(async () => {
		await cleanupTests();
	});

	it(
		'should perform runtime',
		async () => {
			// ARRANGE -- all tests share the same genesis pool data
			v.pool = {
				...genesis_pool,
			} as any;
			await v['runtime'].validateSetConfig(v.pool.data!.config);
			// ACT
			await runCache.call(v);

			expect(v['cacheProvider'].put).toHaveBeenCalledTimes(3);
			const maxBundleSize = parseInt(v.pool.data!.max_bundle_size, 10);
			const lastItem = await v['cacheProvider'].get(`${maxBundleSize - 1}`);
			const firstItem = await v['cacheProvider'].get(`0`);
			const firstItemKeyInt = parseInt(firstItem.key, 10);
			expect(
				typeof firstItemKeyInt === 'number' && !isNaN(firstItemKeyInt)
			).toBe(true);
			expect(lastItem.key.startsWith(reportPrefix)).toBe(true);
			expect(firstItem.value).toEqual(mockItemValue);
			expect(lastItem.value).toEqual(mockReportValue);
		},
		TIMEOUT
	);
});
