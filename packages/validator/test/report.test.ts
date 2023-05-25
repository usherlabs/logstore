import { ethers } from 'ethers';

import { produceReport } from '../src/core/report';
import { Managers } from '../src/managers';
import { getConfig } from '../src/utils/config';
import Validator, { syncPoolConfig } from '../src/validator';
import { genesis_pool } from './mocks/constants';
import { BROKER_NODE_PRIVATE_KEY } from './utils/setup';
import {
	cleanupTests,
	publishQueryMessages,
	publishStorageMessages,
	setupTests,
} from './utils/setup';

const TIMEOUT = 900 * 1000;
const PUBLISH_MESSAGE_COUNT = 15;
const brokerNodeAddress = ethers.computeAddress(BROKER_NODE_PRIVATE_KEY);

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

      const brokerNodeCount = 2;
			await publishStorageMessages(PUBLISH_MESSAGE_COUNT); // these messages are being fired after the current key...
			await publishQueryMessages(PUBLISH_MESSAGE_COUNT, brokerNodeCount);

			const now = Date.now();
			const currentKey = `report_${now}`; // for a maxBundleSize of 3, keys are [now - 1000, now, report_{now}]
			v.pool = {
				...genesis_pool,
				current_key: currentKey,
			} as any;
			// Re-initate the Validator now that the listener has started.
			await syncPoolConfig.call(v); // This will be called iteratively within the runNode() method of Kyve Protocol/Validator

			const storeCache = v.listener.storeDb();
			const queryRequestCache = v.listener.queryRequestDb();
			const queryResponseCache = v.listener.queryResponseDb();
			// Implement AsyncIterable into Mock
			let storeCacheCount = 0;
			for (const { key: _k, value: _v } of storeCache.getRange()) {
				storeCacheCount++;
			}
			let queryRequestCacheCount = 0;
			for (const { key: _k, value: _v } of queryRequestCache.getRange()) {
				queryRequestCacheCount++;
			}
			let queryResponseCacheCount = 0;
			for (const { key: _k, value: _v } of queryResponseCache.getRange()) {
				queryResponseCacheCount++;
			}

			expect(storeCacheCount).toBe(PUBLISH_MESSAGE_COUNT); // total count of messages cached in storage cache
			expect(queryRequestCacheCount).toBe(PUBLISH_MESSAGE_COUNT);
			expect(queryResponseCacheCount).toBe(
				PUBLISH_MESSAGE_COUNT * brokerNodeCount
			);

			const config = getConfig(v);
			const managers = new Managers(config.sources[0]);
			await managers.init();
			const report = await produceReport(v, managers, currentKey);

			console.log('Result Report', report);

			expect(report.id).toBe(`report_${now}`);
			expect(report.events?.queries.length).toBe(PUBLISH_MESSAGE_COUNT);
			expect(report.events?.storage.length).toBe(PUBLISH_MESSAGE_COUNT);
			expect(report.treasury).toBe(115000000000000);
			expect(report.consumers).toEqual([
				{ id: '0x00000000000', capture: 230000000000000, bytes: 230 },
			]);
			expect(report.streams).toEqual([
				{
					id: '0x55B183b2936B57CB7aF86ae0707373fA1AEc7328/test',
					capture: 0,
					bytes: 230,
				},
			]);
			expect(report.delegates[brokerNodeAddress][brokerNodeAddress]).toEqual(
				115000000000000
			);
		},
		TIMEOUT
	);
});
