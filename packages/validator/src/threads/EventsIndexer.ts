import { KyveLCDClientType } from '@kyvejs/sdk';
import { QueryFinalizedBundlesResponse } from '@kyvejs/types/lcd/kyve/query/v1beta1/bundles';
import type { StakeDelegateUpdatedEvent } from '@logsn/contracts/dist/src/NodeManager.sol/LogStoreNodeManager';
import type {
	DataStoredEvent,
	StoreUpdatedEvent,
} from '@logsn/contracts/dist/src/StoreManager.sol/LogStoreManager';
import axios from 'axios';
import { Base64 } from 'js-base64';
import type { RootDatabase } from 'lmdb';
import { isEmpty, range } from 'lodash';
import path from 'path';
import { BehaviorSubject, filter, firstValueFrom } from 'rxjs';
import type { Logger } from 'tslog';

import type { ChainSources } from '../sources';
import { Database } from '../utils/database';
import { gunzip } from '../utils/gzip';

export enum EventSelect {
	StoreUpdated,
	StakeDelegateUpdated,
	DataStored,
}

const EventSelectKeys = Object.keys(EventSelect)
	.map((key) => EventSelect[key])
	.filter((value) => typeof value === 'string') as string[];
const createEmptyEventSelect = () =>
	EventSelectKeys.reduce((acc, curr) => {
		acc[curr] = [];
		return acc;
	}, {});

type BlockNumber = number;
type Events = {
	StoreUpdated?: StoreUpdatedEvent[];
	StakeDelegateUpdated?: StakeDelegateUpdatedEvent[];
	DataStored?: DataStoredEvent[];
	// ? We can add more here later... however, we'll need to handle data migrations within the validator node for upgrades
	// ? ie. An upgrade where the next bundle collects all events since start block - we can split the txs up too
};
type EventsByBlock = {
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
	protected _cachePath: string;
	private _db!: DB;
	private $ready = new BehaviorSubject(false);
	private _latestColdBlockNumber: number; // Latest block number that is cold-stored

	constructor(
		homeDir: string,
		protected poolId: string,
		protected startBlockNumber: number,
		protected chain: ChainSources,
		protected kyve: KyveLCDClientType[],
		protected logger: Logger
	) {
		this._cachePath = path.join(homeDir, '.logstore-events');
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
		const dbPath = path.join(this._cachePath, 'cache');
		this._db = Database.create('events-index', dbPath) as DB;
	}

	private logStartupInfo(): void {
		this.logger.info('Starting EventsIndexer ...');
		this.logger.info(
			'EventsIndexer: Start Block Number:',
			this.startBlockNumber
		);
	}

	private markAsReady(): void {
		this.$ready.next(true);
		this.logger.debug('EventsIndexer: Ready!');
	}

	// will return once ready
	public async ready() {
		return firstValueFrom(this.$ready.pipe(filter((ready) => ready === true)));
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

	private processResults(
		results: Pick<QueryFinalizedBundlesResponse, 'finalized_bundles'>
	) {
		const eventsTxIds: string[] = [];
		for (let j = 0; j < results.finalized_bundles.length; j++) {
			const fb = results.finalized_bundles[j];
			if (fb.storage_id.startsWith('v0_')) {
				const encodedId = fb.storage_id.substring(3, fb.storage_id.length);
				const txIds = Base64.decode(encodedId).split(',');
				if (txIds.length > 2) {
					eventsTxIds.push(txIds.at(-1));
				}
			}
		}
		return eventsTxIds;
	}

	private validateClientResults(reqCounts: number[], reqTotals: number[]) {
		if (
			!reqCounts.every((n) => n === reqCounts[0]) ||
			!reqTotals.every((n) => n === reqTotals[0])
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
		return events.at(-1).k;
	}

	/**
	 * Performs a query against RPC Endpoints, and (optionally) combines with previous events for full history
	 *
	 * To be used in Runtime summarize to fetch all events that have not been previously stored in a bundle
	 */
	public async query(eventsToFilterFor: EventSelect[], toBlockNumber?: number) {
		// ? If the index already exists, check it's latest data.
		const results: { block: BlockNumber; value: Events }[] = [];
		for (const { key: key, value } of this._db.getRange()) {
			const finalValue: Events = {};
			if (
				eventsToFilterFor.includes(EventSelect.StoreUpdated) &&
				value.StoreUpdated
			) {
				finalValue.StoreUpdated = value.StoreUpdated;
			}
			if (
				eventsToFilterFor.includes(EventSelect.StakeDelegateUpdated) &&
				value.StakeDelegateUpdated
			) {
				finalValue.StakeDelegateUpdated = value.StakeDelegateUpdated;
			}
			if (
				eventsToFilterFor.includes(EventSelect.DataStored) &&
				value.DataStored
			) {
				finalValue.DataStored = value.DataStored;
			}
			if (!isEmpty(finalValue)) {
				results.push({ block: key, value: finalValue });
			}
		}

		const latestBlockNumber = this.latestBlockNumber;
		if (toBlockNumber && toBlockNumber > latestBlockNumber) {
			const fromBlockNumber = latestBlockNumber + 1;

			const newEvents = await this.chain.use(async (source) => {
				const events: Events = createEmptyEventSelect();
				for (const eventType of eventsToFilterFor) {
					events[eventType] = await queryContract(
						source,
						getContractName(eventType),
						eventType,
						fromBlockNumber,
						toBlockNumber
					);
				}
				return events;
			});

			if (!isEmpty(newEvents)) {
				// Add new events to results.
				const blockRange = range(fromBlockNumber, toBlockNumber + 1);
				for (const blockNumber of blockRange) {
					const indexEvent: Events = {};
					for (const eventType of eventsToFilterFor) {
						const eventsInBlock = filterEventsByType(
							newEvents[eventType],
							blockNumber
						);
						updateIndexEvent(indexEvent, eventType, eventsInBlock);
					}

					if (!isEmpty(indexEvent)) {
						results.push({ block: blockNumber, value: indexEvent });

						// index new event
						await this.db().put(blockNumber, indexEvent);
					}
				}
			}
		}

		return results;
	}

	/**
	 * Prepares the indexed events that are not in cold storage for cold storage
	 */
	public prepare(lock = false) {
		const events: EventsByBlock[] = [];
		// ? Start from the block number after the latest block number stored to cold store.
		for (const { key, value } of this._db.getRange({
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
		if (!this._db) {
			throw new Error('Database is not initialised');
		}
		return this._db;
	}

	/**
	 * Fetch all storage ids that include indexed events.
	 * Load all events into cache
	 */
	private async hydrate() {
		this.logger.info('EventsIndexer: Hydrating...');

		let count = 0;
		let total = -1;
		const reqNextKeys: string[] = Array(this.kyve.length).fill(undefined);

		while (count < total || total < 0) {
			const reqCounts: number[] = [];
			const reqTotals: number[] = [];
			const eventsTxIds: string[] = [];

			for (let i = 0; i < this.kyve.length; i++) {
				const client = this.kyve[i];
				const results = await this.queryClient(client, reqNextKeys[i]);

				reqCounts.push(results.finalized_bundles.length);
				reqTotals.push(parseInt(results.pagination.total, 10));
				reqNextKeys[i] = results.pagination.next_key;
				eventsTxIds.push(...this.processResults(results));
			}

			this.validateClientResults(reqCounts, reqTotals);

			total = reqTotals[0];
			count += reqCounts[0];
			this.logger.info(
				`EventsIndexer: Hydrate - Total: ${total}, Count: ${count}`
			);

			if (eventsTxIds.length === 0) {
				continue;
			}

			const txId = eventsTxIds[0];
			this._latestColdBlockNumber = await this.fetchAndProcessEvents(txId);
		}

		this.logger.info('EventsIndexer: Hydration complete!');
	}
}

// Helper function to filter events by type
const filterEventsByType = (eventList, eventType) => {
	return eventList.filter((ev) => ev.blockNumber === eventType);
};

// Helper function to update the indexEvent object
const updateIndexEvent = (indexEvent, eventType, eventsInBlock) => {
	if (eventsInBlock.length > 0) {
		indexEvent[eventType] = eventsInBlock;
	}
};

// Helper function to query contract
const queryContract = async (
	source,
	contractName,
	filterName,
	fromBlockNumber,
	toBlockNumber
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
