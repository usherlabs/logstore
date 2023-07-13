import { sleep } from '@kyvejs/protocol';
import type { KyveLCDClientType } from '@kyvejs/sdk';
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
import type { Logger } from 'tslog';

import type { ChainSources } from '../sources';
import { Database } from '../utils/database';
import { gunzip } from '../utils/gzip';

export enum EventSelect {
	StoreUpdated,
	StakeDelegateUpdated,
	DataStored,
}

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
	private _ready: boolean = false;
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
		const dbPath = path.join(this._cachePath, 'cache');
		this._db = Database.create('events-index', dbPath) as DB;

		this.logger.info('Starting EventsIndexer ...');
		this.logger.info(
			'EventsIndexer: Start Block Number: ',
			this.startBlockNumber
		);

		await this.hydrate();
		this._ready = true;
		this.logger.debug('EventsIndexer: Ready!');
	}

	// Wait until the Indexer is ready
	public async ready() {
		while (!this._ready) {
			await sleep(1000);
		}
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
				const collectedEvents: Events = {};
				if (eventsToFilterFor.includes(EventSelect.StoreUpdated)) {
					const contract = await source.contracts.store();
					const events = await contract.queryFilter(
						contract.filters.StoreUpdated(),
						fromBlockNumber,
						toBlockNumber
					);
					if (!isEmpty(events)) {
						collectedEvents.StoreUpdated = events;
					}
				}
				if (eventsToFilterFor.includes(EventSelect.StakeDelegateUpdated)) {
					const contract = await source.contracts.node();
					const events = await contract.queryFilter(
						contract.filters.StakeDelegateUpdated(),
						fromBlockNumber,
						toBlockNumber
					);
					if (!isEmpty(events)) {
						collectedEvents.StakeDelegateUpdated = events;
					}
				}
				if (eventsToFilterFor.includes(EventSelect.DataStored)) {
					const contract = await source.contracts.store();
					const events = await contract.queryFilter(
						contract.filters.DataStored(),
						fromBlockNumber,
						toBlockNumber
					);
					if (!isEmpty(events)) {
						collectedEvents.DataStored = events;
					}
				}

				return collectedEvents;
			});
			if (!isEmpty(newEvents)) {
				// Add new events to results.
				const blockRange = range(fromBlockNumber, toBlockNumber + 1);
				for (const blockNumber of blockRange) {
					const indexEvent: Events = {};
					const storeUpdatedEventsInBlock = newEvents.StoreUpdated.filter(
						(ev) => ev.blockNumber === blockNumber
					);
					if (storeUpdatedEventsInBlock.length > 0) {
						indexEvent.StoreUpdated = storeUpdatedEventsInBlock;
					}
					const stakeDelegateUpdatedEventsInBlock =
						newEvents.StakeDelegateUpdated.filter(
							(ev) => ev.blockNumber === blockNumber
						);
					if (stakeDelegateUpdatedEventsInBlock.length > 0) {
						indexEvent.StakeDelegateUpdated = stakeDelegateUpdatedEventsInBlock;
					}
					const dataStoredEventsInBlock = newEvents.DataStored.filter(
						(ev) => ev.blockNumber === blockNumber
					);
					if (dataStoredEventsInBlock.length > 0) {
						indexEvent.DataStored = dataStoredEventsInBlock;
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
		let total = -1; // start at -1 to indicat that the hydration has not started. If there are no finalized bundles, total will be replaced with 0
		while (count < total || total < 0) {
			const reqCounts = [];
			const reqTotals = [];
			const reqNextKeys = [];
			const eventsTxIds = [];

			for (let i = 0; i < this.kyve.length; i++) {
				const client = this.kyve[i];
				const results = await client.kyve.query.v1beta1.finalizedBundles({
					pool_id: this.poolId,
					pagination: {
						key:
							typeof reqNextKeys[i] !== 'undefined'
								? reqNextKeys[i]
								: undefined,
						limit: '200',
						count_total: true,
					},
				});

				reqCounts.push(results.finalized_bundles.length);
				reqTotals.push(parseInt(results.pagination.total, 10));
				reqNextKeys.push(results.pagination.next_key);

				// Process results
				for (let j = 0; j < results.finalized_bundles.length; j++) {
					const fb = results.finalized_bundles[j];
					// See ArweaveSplit Storage Provider for reference
					if (fb.storage_id.startsWith('v0:')) {
						const encodedId = fb.storage_id.substring(3, fb.storage_id.length);
						const txIds = Base64.decode(encodedId).split(',');
						// ? For v0: decoded tx ids are comma separated, like so: messages,report,events
						if (txIds.length > 2) {
							eventsTxIds.push(txIds.at(-1));
						}
					}
				}
			}

			// Validate the different client results
			if (
				!reqCounts.every((n) => n === reqCounts[0]) ||
				!reqTotals.every((n) => n === reqTotals[0]) ||
				!eventsTxIds.every((id) => id === eventsTxIds[0])
			) {
				throw new Error('Receiving different results from Kyve LCD clients');
			}
			total = reqTotals[0];
			count += reqCounts[0];
			this.logger.info(
				`EventsIndexer: Hydrate - Total: ${total}, Count: ${count}`
			);

			if (eventsTxIds.length === 0) {
				continue;
			}

			const txId = eventsTxIds[0];

			// Fetch bundle from id and index
			const { data } = await axios.get(`https://arweave.net/${txId}`, {
				responseType: 'arraybuffer',
				timeout: 30000,
			});
			const raw = await gunzip(data);
			const events = JSON.parse(raw.toString()) as EventsByBlock[];
			const db = this.db();
			await db.transaction(() => {
				for (const event of events) {
					/* eslint-disable-next-line */
					db.put(event.k, event.v);
				}
			});
			this._latestColdBlockNumber = events.at(-1).k;
		}

		this.logger.info('EventsIndexer: Hydration complete!');
	}
}
