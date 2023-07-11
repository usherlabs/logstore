import { sha256, sleep } from '@kyvejs/protocol';
import type { StakeDelegateUpdatedEvent } from '@logsn/contracts/dist/src/NodeManager.sol/LogStoreNodeManager';
import type {
	DataStoredEvent,
	StoreUpdatedEvent,
} from '@logsn/contracts/dist/src/StoreManager.sol/LogStoreManager';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import fse from 'fs-extra';
import type { RootDatabase } from 'lmdb';
import path from 'path';
import shell from 'shelljs';
import type { Logger } from 'tslog';

import { copyFromTimeIndex } from '../env-config';
import { Managers } from '../managers';
import { IConfig } from '../types';
import { Database } from '../utils/database';

type BlockNumber = number;
type DB = RootDatabase<
	{
		StoreUpdated?: StoreUpdatedEvent;
		StakeDelegateUpdated?: StakeDelegateUpdatedEvent;
		DataStored?: DataStoredEvent;
		// ? We can add more here later... however, we'll need to handle data migrations within the validator node for upgrades
		// ? ie. An upgrade where the next bundle collects all events since start block - we can split the txs up too
	},
	BlockNumber
>;

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
	private _running: boolean = false;
	private _ready: boolean = false;
	private _latestBlockNumber: number;

	constructor(
		homeDir: string,
		protected config: IConfig,
		protected logger: Logger
	) {
		this._cachePath = path.join(homeDir, '.logstore-events');
	}

	public get latestTimestamp() {
		return this._latestBlockNumber;
	}

	/**
	 * Start by paginating through bundles and identifying whether storage_ids contain events.
	 * If so, then index them locally.
	 * Once complete, mark as ready.
	 *
	 * @return  {Promise<void>}[return description]
	 */
	public async start(): Promise<void> {
		this._running = true;
	}

	public stop() {
		this._running = false;
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

	protected db() {
		if (!this._db) {
			throw new Error('Database is not initialised');
		}
		return this._db;
	}
}
