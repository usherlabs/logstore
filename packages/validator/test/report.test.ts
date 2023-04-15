import { Managers } from '../src/classes/Managers';
import { produceReport } from '../src/core/report';
import { getConfig } from '../src/utils/config';
// import type { StreamrMessage } from '../../src/types';
import Validator, { syncPoolConfig } from '../src/validator';
// import { TestListenerCacheProvider } from './mocks/cache.mock';
import { genesis_pool } from './mocks/constants';
import {
	cleanupTests,
	publishQueryMessages,
	publishStorageMessages,
	setupTests,
} from './utils/setup';

const TIMEOUT = 90 * 1000;

describe('Report', () => {
	let v: Validator;

	beforeEach(async () => {
		v = await setupTests();
	}, TIMEOUT);

	afterEach(async () => {
		await cleanupTests();
	});

	it(
		'should produce a report based on system messages',
		async () => {
			// ARRANGE -- all tests share the same genesis pool data
			v.pool = {
				...genesis_pool,
			} as any;
			// ACT
			await syncPoolConfig.call(v);
			await v.listener.start();

			await publishStorageMessages(15); // these messages are being fired after the current key...
			await publishQueryMessages(15);

			const now = Date.now();
			const currentKey = `report_${now}`; // for a maxBundleSize of 3, keys are [now - 1000, now, report_{now}]
			v.pool = {
				...genesis_pool,
				current_key: currentKey,
			} as any;
			// Re-initate the Validator now that the listener has started.
			await syncPoolConfig.call(v); // This will be called iteratively within the runNode() method of Kyve Protocol/Validator

			const db = v.listener.db();
			// Implement AsyncIterable into Mock
			let listenerCacheCount = 0;
			for (const { key: _k, value: _v } of db.getRange()) {
				listenerCacheCount++;
			}

			expect(listenerCacheCount).toBe(31); // 30 + the initial event

			const config = getConfig(v);
			const managers = new Managers(config.sources[0], config.contracts);
			const report = await produceReport(v, managers, currentKey);

			console.log('Result Report', report);

			expect(report.id).toBe(`report_${now}`);
			expect(report.events.queries.length).toBe(15);
			expect(report.events.storage.length).toBe(15);
			// expect(report.treasury).toBe();
			// expect(report.consumers).toEqual();
			// expect(report.streams).toEqual();
			// expect(report.nodes).toEqual();

			expect(report).toEqual({
				key: `report_${now}`,
				value: {
					id: `report_${now}`,
					height: 427294,
					treasury: 0,
					streams: [],
					consumers: [],
					nodes: {},
					delegates: {},
					events: { queries: [], storage: [] },
				},
			});
		},
		TIMEOUT
	);
});
