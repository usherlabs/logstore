import { ethers } from 'ethers';

import { Report } from '../src/core/report';
import Validator from '../src/validator';
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
const brokerNodeAddress = ethers.utils.computeAddress(BROKER_NODE_PRIVATE_KEY);

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
			await v['runtime'].validateSetConfig(v.pool.data!.config);
			v['runtime'].setupThreads(v, v['home']);

			// ACT
			// const brokerNodeCount = 2;
			const storageMessages = await publishStorageMessages(
				PUBLISH_MESSAGE_COUNT
			); // these messages are being fired after the current key...
			// await publishQueryMessages(PUBLISH_MESSAGE_COUNT, brokerNodeCount);

			const now = Date.now();
			const currentKey = `report_${now}`; // for a maxBundleSize of 3, keys are [now - 1000, now, report_{now}]
			v.pool = {
				...genesis_pool,
				current_key: currentKey,
			} as any;
			// Re-initate the Validator now that the listener has started.

			const storeCache = v['runtime'].listener.storeDb();
			// const queryRequestCache = v['runtime'].listener.queryRequestDb();
			// const queryResponseCache = v['runtime'].listener.queryResponseDb();
			let storeCacheCount = 0;
			try {
				for (const { key: _k, value: _v } of storeCache.getRange({
					start: storageMessages[0].timestamp,
					end: storageMessages[storageMessages.length - 1].timestamp,
				})) {
					storeCacheCount++;
				}
			} catch (e) {
				console.log('getKeys error', e);
			}
			// const requestIds = [];
			// for (const { key: _k, value: _v } of queryRequestCache.getRange({})) {
			// 	_v.forEach((value) => {
			// 		requestIds.push(value.content.requestId);
			// 	});
			// }
			// const responses = [];
			// for (const requestId of requestIds) {
			// 	const _v = queryResponseCache.get(requestId);
			// 	_v.forEach((value) => {
			// 		responses.push(value);
			// 	});
			// }

			expect(storeCacheCount).toBe(PUBLISH_MESSAGE_COUNT); // total count of messages cached in storage cache
			// expect(requestIds.length).toBe(PUBLISH_MESSAGE_COUNT);
			// expect(responses.length).toBe(PUBLISH_MESSAGE_COUNT * brokerNodeCount);

			// const report = new Report(
			// 	v,
			// 	v['runtime'].listener,
			// 	v['runtime'].config,
			// 	currentKey
			// );
			// await report.prepare();
			// const value = await report.generate();

			// console.log('Result Report', value);

			// expect(value.id).toBe(`report_${now}`);
			// expect(value.events?.queries.length).toBe(PUBLISH_MESSAGE_COUNT);
			// expect(value.events?.storage.length).toBe(PUBLISH_MESSAGE_COUNT);
			// expect(value.treasury).toBe(115000000000000);
			// expect(value.consumers).toEqual([
			// 	{ id: '0x00000000000', capture: 230000000000000, bytes: 230 },
			// ]);
			// expect(value.streams).toEqual([
			// 	{
			// 		id: '0x55B183b2936B57CB7aF86ae0707373fA1AEc7328/test',
			// 		capture: 0,
			// 		bytes: 230,
			// 	},
			// ]);
			// expect(value.delegates[brokerNodeAddress][brokerNodeAddress]).toEqual(
			// 	115000000000000
			// );
		},
		TIMEOUT
	);
});
