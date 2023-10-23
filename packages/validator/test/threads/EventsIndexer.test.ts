import { bundleToBytes } from '@kyvejs/protocol';
import { LogStoreNodeManager__factory } from '@logsn/contracts';
import { transactionSplitProtocol } from '@logsn/protocol';
import axios from 'axios';

import { ChainSources, IChainSource } from '../../src/sources';
import {
	EventSelect,
	EventsIndexer,
	fetchContractEvents,
} from '../../src/threads';
import { Database } from '../../src/utils/database';
import { gzip } from '../../src/utils/gzip';
import {
	ChainSourcesMock,
	contractsMock,
	getContractMock,
	mockProvider,
} from '../mocks/ChainSourceMock';
import { logger } from '../mocks/LoggerMock';
import { eventsMock } from '../utils/bundle';
import { testHomeDir } from '../utils/constants';
import { kyveMock } from './event-indexer-mocks';

const mockAxiosResponseForBundle = async (data: any) => {
	const compressedData = await gzip(bundleToBytes(data));
	jest.spyOn(axios, 'get').mockResolvedValue({
		data: compressedData,
	});
};

describe('EventsIndexer', () => {
	const cleanupFns = new Set<() => void>();
	afterEach(() => {
		jest.clearAllMocks();
		cleanupFns.forEach((fn) => fn());
		cleanupFns.clear();
	});

	it('queryContract mock', async () => {
		const source = { contracts: contractsMock } as unknown as IChainSource;
		const contractName = 'node';
		const filterName = EventSelect.StakeDelegateUpdated;
		const fromBlockNumber = 1;
		const toBlockNumber = 10;

		const events = await fetchContractEvents(
			source,
			contractName,
			filterName,
			fromBlockNumber,
			toBlockNumber
		);

		expect(events).toEqual([
			{
				address: 'node1',
			},
		]);
	});

	test('hydrate works', async () => {
		const createSpy = jest.spyOn(Database, 'create');
		const put = jest.fn();
		// @ts-expect-error this is a mock
		createSpy.mockReturnValue({
			put: put,
			transaction: async (fn) => fn(),
		});

		const bundleStorageIds = ['1', '2', '3'].map((i) =>
			transactionSplitProtocol.getStorageId([
				`msg_transaction_${i}`,
				`report_transaction_${i}`,
				`events_transaction_${i}`,
			])
		);

		jest
			.spyOn(kyveMock.kyve.query.v1beta1, 'finalizedBundles')
			.mockResolvedValueOnce({
				pagination: {
					next_key: 'next_key',
					total: '3', // 3 bundles
				},
				finalized_bundles: [
					// @ts-expect-error this is a mock
					{ storage_id: bundleStorageIds[0] },
					// @ts-expect-error this is a mock
					{ storage_id: bundleStorageIds[1] },
				],
			})
			.mockResolvedValueOnce({
				pagination: {
					next_key: 'next_key',
					total: '3', // 3 bundles
				},
				// @ts-expect-error this is a mock
				finalized_bundles: [{ storage_id: bundleStorageIds[2] }],
			});

		await mockAxiosResponseForBundle(eventsMock);

		const indexer = new EventsIndexer(
			testHomeDir,
			'1',
			0,
			//
			{} as ChainSourcesMock,
			[kyveMock],
			logger
		);

		await indexer.start();

		await indexer.ready();

		const callArgs = put.mock.calls;

		// calls twice, once for each bundle that returns this same event
		expect(callArgs).toEqual([
			[eventsMock[0].k, eventsMock[0].v],
			[eventsMock[0].k, eventsMock[0].v],
		]);
	});

	test('mock contract', async () => {
		const [adminWallet, userWallet] = mockProvider.getWallets();
		const nodeManagerFactory = new LogStoreNodeManager__factory(adminWallet);
		const nodeManagaer = await nodeManagerFactory.deploy();

		const value = await nodeManagaer.balanceOf(userWallet.address);

		expect(value).toBe(0);
	});

	test('query works', async () => {
		// we want to create a test where it:
		// - creates a new indexer
		// - hydrates it with 0 bundles (we want to test the RPC calls)
		// - queries it selecting StakeDelegateUpdated event
		//
		// then we want to ensure:
		// - the query returns the correct events
		// - the format is correct
		// - it is correctly fetched from the RPC
		// - nothing is fetched from the DB at start
		// - this new event is added to the DB

		const createDBSpy = jest.spyOn(Database, 'create');
		createDBSpy.mockImplementationOnce((...args) => {
			const db = Database.create(...args);
			db.clearSync();
			cleanupFns.add(() => db.clearSync());
			return db;
		});
		const getCreatedDb = () => {
			const calls = createDBSpy.mock.calls;
			return Database.create(...calls[calls.length - 1]);
		};

		jest
			.spyOn(kyveMock.kyve.query.v1beta1, 'finalizedBundles')
			.mockResolvedValueOnce({
				pagination: {
					next_key: undefined,
					total: '0',
				},
				finalized_bundles: [],
			});

		const { contractMock, nodeManager } = await getContractMock();

		const source = { contracts: contractMock } as unknown as IChainSource;
		jest
			// @ts-expect-error private method, typescript doesn't know
			.spyOn(ChainSources.prototype, 'aggregate')
			// @ts-expect-error typescript limitation
			.mockImplementation((c) => c[0]);

		const indexer = new EventsIndexer(
			testHomeDir,
			'1',
			0,
			new ChainSourcesMock([source]),
			[kyveMock],
			logger
		);

		await indexer.start();
		await indexer.ready();

		const db = getCreatedDb();

		// ensure db still seems empty, so nothing was fetched from it
		expect(db.getRange().asArray).toEqual([]);

		// any kind of event fetch will get these
		jest.spyOn(nodeManager, 'queryFilter').mockResolvedValueOnce([
			// @ts-expect-error this is a mock
			{ blockNumber: 1, address: 'eventaddress1' },
			// @ts-expect-error this is a mock
			{ blockNumber: 2, address: 'eventaddress2' },
			// @ts-expect-error this is a mock
			{ blockNumber: 3, address: 'eventaddress3' },
			// @ts-expect-error this is a mock
			{ blockNumber: 3, address: 'eventaddress4' },
		]);

		const events = await indexer.query([EventSelect.StakeDelegateUpdated], 10);

		expect(events).toEqual([
			{
				block: 1,
				value: {
					[EventSelect.StakeDelegateUpdated]: [
						{ blockNumber: 1, address: 'eventaddress1' },
					],
				},
			},
			{
				block: 2,
				value: {
					[EventSelect.StakeDelegateUpdated]: [
						{ blockNumber: 2, address: 'eventaddress2' },
					],
				},
			},
			{
				block: 3,
				value: {
					[EventSelect.StakeDelegateUpdated]: [
						{ blockNumber: 3, address: 'eventaddress3' },
						{ blockNumber: 3, address: 'eventaddress4' },
					],
				},
			},
		]);

		expect(db.get(3)).toEqual({
			[EventSelect.StakeDelegateUpdated]: [
				{ blockNumber: 3, address: 'eventaddress3' },
				{ blockNumber: 3, address: 'eventaddress4' },
			],
		});
	});
});
