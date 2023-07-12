// TODO: Update the following Unit Tests for compatibility with latest changes.
import { bytesToBundle } from '@kyvejs/protocol';
import { runCache, runNode } from '@kyvejs/protocol/dist/src/methods';
import { KyveRegistryLCDClient } from '@kyvejs/sdk/dist/clients/lcd-client/query/v1beta1/query';
import { DeepPartial } from '@kyvejs/types/lcd/google/api/http';
import { PoolResponse } from '@kyvejs/types/lcd/kyve/query/v1beta1/pools';
import { SystemReport } from '@logsn/protocol';

import { BundleMessage, Item } from '../src/core/item';
import { Report } from '../src/core/report';
import { SystemListener } from '../src/threads';
import Validator from '../src/validator';
import { genesis_pool } from './mocks/constants';
import { cleanupTests, setupTests, storageProvider } from './utils/setup';

const TIMEOUT = 900 * 1000;

jest.mock('../src/core/item');
jest.mock('../src/core/report');

const mockReportValue = new SystemReport({
	id: 'HELLO_WORLD',
	height: 100,
	treasury: '0',
	v: 1,
	s: false,
	streams: [],
	consumers: [],
	nodes: {},
	delegates: {},
	events: {
		queries: [],
		storage: [],
	},
});
const mockItemValue = [
	{ content: 'hello', metadata: {} as any },
	{ content: 'world', metadata: {} as any },
] satisfies BundleMessage[];

describe('Runtime', () => {
	let v: Validator;

	beforeEach(async () => {
		v = await setupTests();

		// This runtime test will execute the Item and Report Core DataItem generators, however, we're testing everything else here.
		jest.spyOn(Item.prototype, 'generate').mockImplementation(async () => {
			return mockItemValue;
		});
		jest.spyOn(Report.prototype, 'generate').mockImplementation(async () => {
			return mockReportValue;
		});
	}, TIMEOUT);

	afterEach(async () => {
		await cleanupTests().catch((e) => {});
	});

	it(
		'should perform runtime',
		async () => {
			// ARRANGE -- all tests share the same genesis pool data
			const testStartTime = new Date().getTime();
			const start_key = String(testStartTime / 1000);
			const current_key = String(testStartTime / 1000 - 200);
			v.pool = {
				...genesis_pool,
				data: {
					...genesis_pool.data,
					start_key: start_key,
					current_key: current_key,
				},
				bundle_proposal: {
					...genesis_pool.bundle_proposal,
					storage_id: '',
					uploader: '',
					next_uploader: 'test_staker',
					data_size: '0',
					data_hash: '',
					bundle_size: '0',
					from_key: '',
					to_key: '',
					bundle_summary: '',
					updated_at: '0',
				},
			} as DeepPartial<PoolResponse> as PoolResponse;

			let count = 0;
			v['runtime'].nextKey = jest.fn().mockImplementation(() => {
				return count++;
			});

			const txs = v['client'][0].kyve.bundles.v1beta1;
			// this should be incremented to make the test shorter
			process.env.START_BLOCK_NUMBER = '669232';

			v['lcd'][0].kyve.query.v1beta1.canVote = jest.fn().mockResolvedValue({
				possible: false,
				reason: 'Already voted',
			});
			v['lcd'][0].kyve.query.v1beta1.finalizedBundles = jest
				.fn()
				.mockResolvedValue({
					finalized_bundles: [],
					pagination: { next_key: '', total: '0' },
				} as Awaited<ReturnType<KyveRegistryLCDClient['finalizedBundles']>>);

			txs.submitBundleProposal = jest.fn().mockResolvedValue({
				txHash: 'submit_bundle_proposal_test_hash',
				fee: {
					amount: [{ amount: 0 }],
				},
				execute: jest.fn().mockResolvedValue({
					code: 0,
				}),
			});

			let callCount = 0;
			v['syncPoolState'] = jest.fn().mockImplementation(() => {
				callCount++;

				v.pool = {
					...genesis_pool,
					data: {
						...genesis_pool.data,
						start_key,
						current_key,
					},
					bundle_proposal: {
						...genesis_pool.bundle_proposal,
						storage_id: '',
						uploader: '',
						next_uploader: 'test_staker',
						data_size: '0',
						data_hash: '',
						bundle_size: '0',
						from_key: '',
						to_key: '',
						bundle_summary: '',
						updated_at: '0',
					},
				} as DeepPartial<PoolResponse> as PoolResponse;
				if (callCount === 4) {
					v.pool.bundle_proposal.updated_at = (count + 1).toString();
					jest.useFakeTimers({ advanceTimers: true });
					setTimeout(() => {
						jest.advanceTimersToNextTimer(1);
					}, 10);
				}
			});

			await v['runtime'].validateSetConfig(v.pool.data!.config);
			await v['runtime'].setup(v, v['home']);
			// we want to avoid starting system messages management, as they can
			// error on test environment
			SystemListener.prototype.start = jest.fn();
			v['runtime'].runThreads(v);
			await v['runtime'].ready(v, v['syncPoolState']);

			// ACT
			await runCache.call(v);

			expect(v['cacheProvider'].put).toHaveBeenCalledTimes(3);
			const maxBundleSize = parseInt(v.pool.data!.max_bundle_size, 10);
			const firstItem = await v['cacheProvider'].get(`${maxBundleSize - 2}`);
			const firstItemKeyInt = parseInt(firstItem.key, 10);
			expect(
				typeof firstItemKeyInt === 'number' && !isNaN(firstItemKeyInt)
			).toBe(true);
			// expect(lastItem.key.startsWith(reportPrefix)).toBe(true);
			expect(firstItem.value['m']).toEqual(mockItemValue);

			// last before stopping round
			(v['continueRound'] as jest.Mock).mockReturnValueOnce(true);
			await runNode.call(v);

			expect(txs.submitBundleProposal).toBeCalledWith({
				bundle_size: '3',
				bundle_summary:
					'3_b0bd18d71c78b9837e0e3d32f52882e0a66a99434058a8bcf39bc01b4cf8b292',
				data_hash:
					'6a59ec0b6805c33ae510081701f79189f7e576702ba5b80ca805224c8edee683',
				data_size: '445',
				from_index: '0',
				from_key: 1,
				pool_id: '0',
				staker: 'test_staker',
				storage_id: 'test_storage_id',
				to_key: 3,
			});

			const savedData = (storageProvider.saveBundle as jest.Mock).mock
				.calls[0][0];

			const dataFromBuffer = bytesToBundle(savedData);
			expect(dataFromBuffer).toEqual([
				{
					key: 1,
					value: {
						m: [
							{ content: 'hello', metadata: {} },
							{ content: 'world', metadata: {} },
						],
					},
				},
				{
					key: 2,
					value: {
						m: [
							{ content: 'hello', metadata: {} },
							{ content: 'world', metadata: {} },
						],
					},
				},
				{
					key: 3,
					value: {
						m: [
							{ content: 'hello', metadata: {} },
							{ content: 'world', metadata: {} },
						],
						r: {
							consumers: [],
							delegates: {},
							events: { queries: [], storage: [] },
							height: 100,
							id: 'HELLO_WORLD',
							nodes: {},
							s: true,
							streams: [],
							treasury: '0x00',
							v: 1,
						},
					},
				},
			]);
		},
		TIMEOUT
	);
});
