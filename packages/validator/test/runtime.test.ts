import { runCache } from '@kyvejs/protocol/src/methods';

import Validator from '../src/validator';
import { reportPrefix } from './../src/utils/constants';
import { genesis_pool } from './mocks/constants';
import { cleanupTests, setupTests } from './utils/setup';

const TIMEOUT = 900 * 1000;

describe('Runtime', () => {
	let v: Validator;

	beforeEach(async () => {
		v = await setupTests();
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
		},
		TIMEOUT
	);
});
