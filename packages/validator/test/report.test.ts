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
			const startKey = `${Date.now() - 3000}`;
			const currentKey = `${parseInt(startKey, 10) + 2000}`;
			v.pool = {
				...genesis_pool,
				start_key: startKey,
				current_key: currentKey,
			} as any;
			// ACT
			await syncPoolConfig.call(v);
			await v.listener.start();
			await publishStorageMessages(15);
			await publishQueryMessages(15);

			const db = v.listener.db();
			// Implement AsyncIterable into Mock
			let listenerCacheCount = 0;
			for (const { key: _k, value: _v } of db.getRange()) {
				listenerCacheCount++;
			}

			expect(listenerCacheCount).toBe(15);

			const config = getConfig(v);
			const managers = new Managers(config.sources[0], config.contracts);
			const report = await produceReport(v, managers, startKey);

			console.log('Result Report', report);

			expect(report.id).toBe(`report_${currentKey}`);
			expect(report.events.queries.length).toBe(15);
			expect(report.events.storage.length).toBe(15);
			// expect(report.treasury).toBe();
			// expect(report.consumers).toEqual();
			// expect(report.streams).toEqual();
			// expect(report.nodes).toEqual();

			expect(report).toEqual({
				key: `report_${currentKey}`,
				value: {
					id: `report_${currentKey}`,
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
