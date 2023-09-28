import { ethers } from 'ethers';

import { Report } from '../src/core/report';
import Validator from '../src/validator';
import { genesis_pool } from './mocks/constants';
import { BROKER_NODE_PRIVATE_KEY } from './utils/setup';
import {
	cleanupTests,
	publishQueryMessages,
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
			const brokerNodeCount = 2;
			// FIXME Old ProofOfMessageStored
			// await publishStorageMessages(PUBLISH_MESSAGE_COUNT); // these messages are being fired after the current key...
			await publishQueryMessages(PUBLISH_MESSAGE_COUNT, brokerNodeCount);

			const now = Date.now();
			const currentKey = `report_${now}`; // for a maxBundleSize of 3, keys are [now - 1000, now, report_{now}]
			v.pool = {
				...genesis_pool,
				current_key: currentKey,
			} as any;
			// Re-initate the Validator now that the listener has started.

			// FIXME Old ProofOfMessageStored
			// const storeCache = v['runtime'].listener.storeDb();
			const queryRequestCache = v['runtime'].listener.db.queryRequestDb();
			const queryResponseCache = v['runtime'].listener.db.queryResponseDb();

			const storeMsgs = [];
			// FIXME Old ProofOfMessageStored
			// for (const { key: _k, value: _v } of storeCache.getRange()) {
			// 	_v.forEach((sMsg) => {
			// 		storeMsgs.push(sMsg);
			// 	});
			// }
			const requestIds = [];
			for (const { key: _k, value: _v } of queryRequestCache.getRange()) {
				_v.forEach((value) => {
					requestIds.push(value.content.requestId);
				});
			}

			let totalConsumerQuerySize = 0;
			const responses = [];
			for (const requestId of requestIds) {
				const _v = queryResponseCache.get(requestId);
				totalConsumerQuerySize += _v[0].content.size;
				_v.forEach((value) => {
					responses.push(value);
				});
			}

			expect(storeMsgs.length).toBe(PUBLISH_MESSAGE_COUNT); // total count of messages cached in storage cache
			expect(requestIds.length).toBe(PUBLISH_MESSAGE_COUNT);
			expect(responses.length).toBe(PUBLISH_MESSAGE_COUNT * brokerNodeCount);

			const report = new Report(
				v,
				v['runtime'].listener,
				v['runtime'].config,
				currentKey
			);
			await report.prepare();
			const value = await report.generate();

			console.log('Result Report', value);

			expect(value.id).toBe(`report_${now}`);
			expect(value.events?.queries.length).toBe(PUBLISH_MESSAGE_COUNT);
			// expect(value.events?.storage.length).toBe(PUBLISH_MESSAGE_COUNT); // TODO: This requires that a test storage stream be created against the devnet
			expect(value.treasury).toBeGreaterThan(0);
			expect(value.consumers.length).toEqual(1);
			expect(value.consumers[0].bytes).toEqual(totalConsumerQuerySize);
			// expect(value.streams.length).toEqual(1);
			// expect(value.streams[0].bytes).toEqual(
			// 	storeMsgs.reduce((acc, c) => {
			// 		acc += c.content.bytes;
			// 		return acc;
			// 	}, 0)
			// );
			// expect(value.delegates[brokerNodeAddress][brokerNodeAddress]).toEqual(
			// 	115000000000000
			// );

			// expect(value).toMatchSnapshot();
		},
		TIMEOUT
	);
});
