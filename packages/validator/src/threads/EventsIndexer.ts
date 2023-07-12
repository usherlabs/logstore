import { bytesToBundle, sha256, sleep } from '@kyvejs/protocol';
import type { KyveLCDClientType } from '@kyvejs/sdk';
import type { StakeDelegateUpdatedEvent } from '@logsn/contracts/dist/src/NodeManager.sol/LogStoreNodeManager';
import type {
	DataStoredEvent,
	StoreUpdatedEvent,
} from '@logsn/contracts/dist/src/StoreManager.sol/LogStoreManager';
import { axios } from 'axios';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import fse from 'fs-extra';
import { Base64 } from 'js-base64';
import type { RootDatabase } from 'lmdb';
import path from 'path';
import shell from 'shelljs';
import type { Logger } from 'tslog';

import { copyFromTimeIndex } from '../env-config';
import { Managers } from '../managers';
import { IConfig } from '../types';
import { Database } from '../utils/database';
import { gunzip } from '../utils/gzip';

type BlockNumber = number;
type Events = {
	StoreUpdated?: StoreUpdatedEvent;
	StakeDelegateUpdated?: StakeDelegateUpdatedEvent;
	DataStored?: DataStoredEvent;
	// ? We can add more here later... however, we'll need to handle data migrations within the validator node for upgrades
	// ? ie. An upgrade where the next bundle collects all events since start block - we can split the txs up too
};
type EventsByBlock = {
	v: Events;
	k: BlockNumber;
};
type DB = RootDatabase<Events, BlockNumber>;

const CONFIRMATIONS = 128 as const; // The number of confirmations/blocks required to determine finality.
const SCAN_BUFFER = 10 as const; // The time (in seconds) a find/scan will use to evaluate the indexed block
const DEFAULT_DB_VALUE = { b: 0, s: [] };
const POLL_INTERVAL = 10 as const; // The time (in seconds) to delay between the latest index and the next
const BATCH_SIZE = 10 as const; // How many blocks to batch in single request

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
	// private _running: boolean = false;
	private _ready: boolean = false;
	private _latestBlockNumber: number; // Latest indexed block number that may or may not be cold-stored
	private _latestColdBlockNumber: number; // Latest block number that is cold-stored
	private _startBlock: number;

	constructor(
		homeDir: string,
		protected poolId: string,
		protected config: IConfig,
		protected kyve: KyveLCDClientType[],
		protected logger: Logger
	) {
		this._cachePath = path.join(homeDir, '.logstore-events');
	}

	public get latestTimestamp() {
		return this._latestBlockNumber;
	}

	public get startBlock() {
		return this._startBlock;
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
		this._db = Database.create('time-index', dbPath) as DB;

		// ? If the index already exists, check it's latest data.
		for (const { key, value } of this._db.getRange({
			reverse: true,
			limit: 1,
		})) {
			this.logger.debug(`Fetch last Events Index item - ${key}: ${value}`);
			this._startBlock = key;
		}

		this.logger.info('Starting EventsIndexer ...');

		if (!this._startBlock) {
			this._startBlock = await Managers.withSources<number>(
				this.config.sources,
				async (managers) => {
					return await managers.node.getStartBlockNumber();
				}
			);
		}

		this.logger.info('EventsIndexer: Start Block Number: ', this._startBlock);

		await this.hydrate();
		this._ready = true;
	}

	// Wait until the Indexer is ready
	public async ready() {
		while (true) {
			if (this._ready) {
				return true;
			}
			await sleep(1000);
		}
	}

	/**
	 * Performs a query against RPC Endpoints, and (optionally) combines with previous events for full history
	 *
	 * To be used in Runtime summarize to fetch all events that have not been previously stored in a bundle
	 */
	public query() {
		// ...
	}

	/**
	 * Prepares the indexed events that are not in cold storage for cold storage
	 */
	public prepare(lock = false) {
		const events: EventsByBlock[] = [];
		// ? If the index already exists, check it's latest data.
		for (const { key, value } of this._db.getRange({
			start: this._latestColdBlockNumber,
			end: this._latestBlockNumber,
		})) {
			events.push({
				k: key,
				v: value,
			});
		}
		if (lock) {
			this._latestColdBlockNumber = this._latestBlockNumber;
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
	 * Index events
	 */
	private async index(events: EventsByBlock[]) {
		// ...
		events.forEach((event) => {
			if (event.k > this._latestBlockNumber) {
				this._latestBlockNumber = event.k;
				this._latestColdBlockNumber = event.k;
			}
		});
	}

	private async indexById(txId: string) {
		const { data } = await axios.get(`https://arweave.net/${txId}`, {
			responseType: 'arraybuffer',
			timeout: 30000,
		});
		const raw = await gunzip(data);
		const events = JSON.parse(raw.toString()) as EventsByBlock[];
		await this.index(events);
	}

	/**
	 * Fetch all storage ids that include indexed events.
	 * Load all events into cache
	 */
	private async hydrate() {
		this.logger.info('Hydrating Events Index...');

		let count = 0;
		let total = 0;
		while (count < total || total === 0) {
			const reqCounts = [];
			let reqTotalSum = 0;
			const reqNextKeys = [];
			let eventsTxId;
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
				// if (reqTotals.length < this.kyve.length) {
				// 	reqTotals.push(parseInt(results.pagination.total, 10));
				// }
				reqTotalSum += parseInt(results.pagination.total, 10);
				reqNextKeys.push(results.pagination.next_key);

				// Process results
				for (let j = 0; j <= results.finalized_bundles.length; j++) {
					const fb = results.finalized_bundles[j];
					// See ArweaveSplit Storage Provider for reference
					if (fb.storage_id.startsWith('v0:')) {
						const encodedId = fb.storage_id.substring(3, fb.storage_id.length);
						const txIds = Base64.decode(encodedId).split(',');
						if (txIds.length > 2) {
							eventsTxId = txIds.at(-1);
						}
					}
				}
			}
			// Validate the different client results
			let reqCountsSum = 0;
			reqCounts.forEach((c) => {
				reqCountsSum += c;
			});
			reqCounts.forEach((c) => {
				if (reqCountsSum / this.kyve.length !== c) {
					throw new Error('Receiving different results from Kyve LCD clients');
				}
			});
			total = reqTotalSum / this.kyve.length;
			count += reqCounts[0];

			if (eventsTxId) {
				// Fetch bundle from id and index
				await this.indexById(eventsTxId);
			}
		}
	}
}
