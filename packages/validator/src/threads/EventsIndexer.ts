import { KyveLCDClientType } from '@kyvejs/sdk';
import { QueryFinalizedBundlesResponse } from '@kyvejs/types/lcd/kyve/query/v1beta1/bundles';
import type { StakeDelegateUpdatedEvent } from '@logsn/contracts/dist/src/NodeManager.sol/LogStoreNodeManager';
import type { DataStoredEvent, StoreUpdatedEvent } from '@logsn/contracts/dist/src/StoreManager.sol/LogStoreManager';
import { transactionSplitProtocol, transactionSplitUtilsV0 } from '@logsn/protocol';
import axios from 'axios';
import type { BaseContract } from 'ethers';
import type { RootDatabase } from 'lmdb';
import { isEmpty, range } from 'lodash';
import path from 'path';
import { BehaviorSubject, filter, firstValueFrom } from 'rxjs';
import type { Logger } from 'tslog';



import type { ChainSources, IChainSource } from '../sources';
import { Database } from '../utils/database';
import { gunzip } from '../utils/gzip';


// ===== Type Safety Utils =====
type ChainSourceContracts = IChainSource['contracts'];
type ResolvedManagerTypes =
	ChainSourceContracts[keyof ChainSourceContracts] extends () => Promise<
		infer C extends BaseContract
	>
		? C
		: never;
type ExtractFilterKeysFrom<T> = T extends { filters: infer Filters }
	? keyof Filters
	: never;

type UnionOfFilterKeys = ExtractFilterKeysFrom<ResolvedManagerTypes>;
// =============================

export const EventSelect = {
	StoreUpdated: 'StoreUpdated',
	StakeDelegateUpdated: 'StakeDelegateUpdated',
	DataStored: 'DataStored',
} as const satisfies {
	[key in UnionOfFilterKeys]?: key;
};

export type EventSelect = (typeof EventSelect)[keyof typeof EventSelect];

const EventSelectKeys = Object.keys(EventSelect)
	.map((key) => EventSelect[key])
	.filter((value) => typeof value === 'string') as string[];
const createEmptyEventSelect = () =>
	EventSelectKeys.reduce((acc, curr) => {
		acc[curr] = [];
		return acc;
	}, {} as Required<Events>);

type BlockNumber = number;
type Events = {
	StoreUpdated?: StoreUpdatedEvent[];
	StakeDelegateUpdated?: StakeDelegateUpdatedEvent[];
	DataStored?: DataStoredEvent[];
	// ? We can add more here later... however, we'll need to handle data migrations within the validator node for upgrades
	// ? ie. An upgrade where the next bundle collects all events since start block - we can split the txs up too
};
export type EventsByBlock = {
	v: Events;
	k: BlockNumber;
};
type DB = RootDatabase<Events, BlockNumber>;

/**
 * Class to manage an index of blocks and their timestamps
 *
 * ? This index only needs to start from the last report's block height, as all bundles moving forward are based on future data.
 * ? If no report exists, then the startBlockNumber is used.
 *
 * This index makes the Validator way more reliable and efficient at managing correlation between blocks and time
 */
export class EventsIndexer {
	protected eventCachePath: string;
	private eventsDB!: DB;
	private isReadySubject = new BehaviorSubject(false);
	private _latestColdBlockNumber: number; // Latest block number that is cold-stored

	constructor(
		homeDir: string,
		protected poolId: string,
		protected startBlockNumber: number,
		protected chain: ChainSources,
		protected kyve: KyveLCDClientType[],
		protected logger: Logger
	) {
		this.eventCachePath = path.join(homeDir, '.logstore-events');
	}

	public get latestBlockNumber() {
		// ? If the index already exists, check it's latest data.
		for (const { key } of this.db().getRange({
			reverse: true,
			limit: 1,
		})) {
			return key;
		}
		return this.startBlockNumber;
	}

	/**
	 * Start by paginating through bundles and identifying whether storage_ids contain events.
	 * If so, then index them locally.
	 * Once complete, mark as ready.
	 *
	 * @return  {Promise<void>}[return description]
	 */
	public async start(): Promise<void> {
		this.initializeDB();
		this.logStartupInfo();
		await this.hydrate();
		this.markAsReady();
	}

	private initializeDB(): void {
		const dbPath = path.join(this.eventCachePath, 'cache');
		this.eventsDB = Database.create('events-index', dbPath) as DB;
	}

	private logStartupInfo(): void {
		this.logger.info('Starting EventsIndexer ...');
		this.logger.info(
			'EventsIndexer: Start Block Number:',
			this.startBlockNumber
		);
	}

	private markAsReady(): void {
		this.isReadySubject.next(true);
		this.logger.debug('EventsIndexer: Ready!');
	}

	// will return once ready
	public async ready() {
		return firstValueFrom(
			this.isReadySubject.pipe(filter((ready) => ready === true))
		);
	}

	private async queryClient(client: KyveLCDClientType, nextKey?: string) {
		return await client.kyve.query.v1beta1.finalizedBundles({
			pool_id: this.poolId,
			pagination: {
				key: nextKey,
				limit: '200',
				count_total: true,
			},
		});
	}

	private getEventTxFromFinalizedBundles(
		finalizedBundles: QueryFinalizedBundlesResponse['finalized_bundles']
	) {
		const eventsTxIds: string[] = [];
		for (let j = 0; j < finalizedBundles.length; j++) {
			const fb = finalizedBundles[j];

			if (transactionSplitProtocol.isSplit(fb.storage_id)) {
				const txIds = transactionSplitProtocol.getTransactionIds(fb.storage_id);
				const eventsTx = transactionSplitUtilsV0.getEventsTransactions(txIds);
				if (eventsTx) {
					eventsTxIds.push(eventsTx);
				}
			} else {
				this.logger.error(
					`Unable to extract transaction id's from storage_id: ${fb.storage_id}`
				);
			}
		}
		return eventsTxIds;
	}

	private validateClientResults(
		bundleCounts: number[],
		bundleTotals: number[]
	) {
		if (
			!bundleCounts.every((n) => n === bundleCounts[0]) ||
			!bundleTotals.every((n) => n === bundleTotals[0])
		) {
			throw new Error('Receiving different results from Kyve LCD clients');
		}
	}

	private async fetchAndProcessEvents(txId: string) {
		const { data } = await axios.get(`https://arweave.net/${txId}`, {
			responseType: 'arraybuffer',
			timeout: 30000,
		});
		const raw = await gunzip(data);
		const events = JSON.parse(raw.toString()) as EventsByBlock[];
		const db = this.db();
		await db.transaction(async () => {
			for (const event of events) {
				await db.put(event.k, event.v);
			}
		});
		return events;
	}

	private async queryFromRPC(
		filterEvents: EventSelect[],
		fromBlockNumber: number,
		toBlockNumber: number
	) {
		const events = await this.chain.use(async (source) => {
			const eventsFromThisRPC = createEmptyEventSelect();

			// we use for..of here to ensure we wait for each event type to be fetched
			// in sequence, not in parallel, to ensure we don't overload the RPC
			for (const eventType of filterEvents) {
				eventsFromThisRPC[eventType] = await fetchContractEvents(
					source,
					getContractName(eventType),
					eventType,
					fromBlockNumber,
					toBlockNumber
				);
			}
			return eventsFromThisRPC;
		});

		if (isEmpty(events)) {
			return [];
		}

		// Add new events to results if we have new events.
		const blockRange = range(fromBlockNumber, toBlockNumber + 1);

		const eventsOrNull = await Promise.all(
			// for each block number, let's get the events in that block,
			// separate them by type, and add them to the results
			blockRange.map(async (blockNumber) => {
				const eventIndexForBlock = filterEvents.reduce((acc, eventType) => {
					const eventsInBlock = filterEventsByBlock(
						events[eventType],
						blockNumber
					);
					if (eventsInBlock.length > 0) {
						return { ...acc, [eventType]: eventsInBlock };
					}
					return acc;
				}, {} as Events);

				return isEmpty(eventIndexForBlock)
					? null
					: { block: blockNumber, value: eventIndexForBlock };
			})
		);

		return eventsOrNull.filter(Boolean);
	}

	/**
	 * Performs a query against RPC Endpoints, and (optionally) combines with previous events for full history
	 *
	 * To be used in Runtime summarize to fetch all events that have not been previously stored in a bundle
	 * Side effect: Stores events queried from RPC in the database
	 */
	public async query(filterEvents: EventSelect[], toBlockNumber?: number) {
		// ? If the index already exists, check it's latest data.

		// ==== Fetching from cache ====
		const resultsFromCache = this.db()
			// gets all events from the database
			.getRange()
			// filters out events that are not in the filterEvents array
			.map(({ key, value }) => {
				const eventsOfThisBlock = filterEvents.reduce((acc, event) => {
					return value[event] ? { ...acc, [event]: value[event] } : acc;
				}, {} as Events);
				return isEmpty(eventsOfThisBlock)
					? null
					: { block: key, value: eventsOfThisBlock };
			})
			// filters out null values
			.filter(Boolean).asArray;

		// ==== Fetching from RPC looking for new events not yet indexed on our Cache ====
		// We do it only if the query requires
		const isFetchingFromRPCRequired =
			toBlockNumber && toBlockNumber > this.latestBlockNumber;
		const resultsFromRPC = isFetchingFromRPCRequired
			? await this.queryFromRPC(
					filterEvents,
					this.latestBlockNumber + 1,
					toBlockNumber
			  )
			: [];

		await Promise.all(
			// in this case, if we manage to fetch from rpc, we'll also index on our cache as a side effect
			resultsFromRPC.map((eventsByBlock) =>
				this.db().put(eventsByBlock.block, eventsByBlock.value)
			)
		);

		return [...resultsFromCache, ...resultsFromRPC];
	}

	/**
	 * Prepares the indexed events that are not in cold storage for cold storage
	 */
	public prepare(lock = false) {
		const events: EventsByBlock[] = [];
		// ? Start from the block number after the latest block number stored to cold store.
		for (const { key, value } of this.db().getRange({
			start:
				this._latestColdBlockNumber > 0 ? this._latestColdBlockNumber + 1 : 0,
		})) {
			events.push({
				k: key,
				v: value,
			});
		}
		if (lock) {
			this._latestColdBlockNumber = this.latestBlockNumber;
		}
		return events;
	}

	protected db() {
		if (!this.eventsDB) {
			throw new Error('Database is not initialised');
		}
		return this.eventsDB;
	}

	/**
	 * Fetch all storage ids that include indexed events.
	 * Load all events into cache
	 */
	private async hydrate() {
		this.logger.info('EventsIndexer: Hydrating...');

		// Initialize count of processed bundles and total bundles to process
		let processedBundlesCount = 0;
		// -1 to ensure the while loop is entered, as the total to process is unknown initially.
		let totalToProcess = -1;
		const nextKeys: string[] = Array(this.kyve.length).fill(undefined); // Holds pagination keys for querying clients

		// The loop continues until all bundles are processed or if the total to process is still unknown.
		while (processedBundlesCount < totalToProcess || totalToProcess < 0) {
			const bundleCountsList: number[] = []; // Holds the count of bundles processed in the current iteration for each client
			const bundleTotalsList: number[] = []; // Holds the total count of bundles to process for each client
			const eventsTxIds: string[] = []; // Holds transaction IDs of events to be processed

			// Iterating through each client to query for bundles and process the results.
			for (let i = 0; i < this.kyve.length; i++) {
				const client = this.kyve[i];
				const results = await this.queryClient(client, nextKeys[i]); // Query client for bundles

				// Update lists with data from current iteration
				bundleCountsList.push(results.finalized_bundles.length);
				bundleTotalsList.push(parseInt(results.pagination.total, 10));
				nextKeys[i] = results.pagination.next_key;
				eventsTxIds.push(
					...this.getEventTxFromFinalizedBundles(results.finalized_bundles)
				);
			}

			// Validate that all clients return consistent results
			this.validateClientResults(bundleCountsList, bundleTotalsList);

			// Updating the total bundles to process and incrementing the processed bundles count for progress tracking.
			totalToProcess = bundleTotalsList[0];
			processedBundlesCount += bundleCountsList[0];
			this.logger.info(
				`EventsIndexer: Hydrate - Total: ${totalToProcess}, Count: ${processedBundlesCount}`
			);

			// Skip to the next iteration if no event transaction IDs are found, to avoid unnecessary processing.
			if (eventsTxIds.length === 0) {
				continue;
			}

			// Fetching and processing events for the first transaction ID found, to begin event processing.
			const txId = eventsTxIds[0];
			const events = await this.fetchAndProcessEvents(txId);
			this._latestColdBlockNumber = events.at(-1).k; // Update the latest block number that is cold-stored
		}

		this.logger.info('EventsIndexer: Hydration complete!');
	}
}

// Helper function to filter events by type
const filterEventsByBlock = (
	eventList: Events[keyof Events],
	blockNumber: number
) => {
	// this is only possible on TS>=5.2
	return eventList.filter((ev) => ev.blockNumber === blockNumber);
};

// Helper function to update the indexEvent object
const updateIndexEvent = (
	indexEvent: Events,
	eventType: EventSelect,
	eventsInBlock: any
) => {
	if (eventsInBlock.length > 0) {
		indexEvent[eventType] = eventsInBlock;
	}
};

export const fetchContractEvents = async (
	source: IChainSource,
	contractName: keyof ChainSourceContracts,
	filterName: EventSelect,
	fromBlockNumber: number,
	toBlockNumber: number
) => {
	const contract = await source.contracts[contractName]();
	return await contract.queryFilter(
		contract.filters[filterName](),
		fromBlockNumber,
		toBlockNumber
	);
};

const getContractName = (eventType: EventSelect): string => {
	const eventToContractMap = {
		[EventSelect.StoreUpdated]: 'store',
		[EventSelect.StakeDelegateUpdated]: 'node',
		[EventSelect.DataStored]: 'store',
	} satisfies {
		[key in EventSelect]: string;
	};
	return eventToContractMap[eventType];
};
