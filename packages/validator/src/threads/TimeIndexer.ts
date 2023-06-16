import {
	callWithBackoffStrategy,
	sleep,
	standardizeJSON,
} from '@kyvejs/protocol';
import fse from 'fs-extra';
import type { RootDatabase } from 'lmdb';
import path from 'path';
import type { Logger } from 'tslog';

import { NotRunningError } from '../errors/NotRunningError';
import { Managers } from '../managers';
import { IConfig } from '../types';
// import { shouldClearTimeIndex } from './env-config';
import { Database } from '../utils/database';

type BlockNumber = number;
type Timestamp = number;
type DB = RootDatabase<BlockNumber, Timestamp>;

const CONFIRMATIONS = 128 as const; // The number of confirmations/blocks required to determine finality.
const POLL_INTERVAL = 10000 as const; // The time to delay between the latest index and the next - 10s
const SCAN_BUFFER = 10000 as const; // The time a find/scan will use to evaluate the indexed block

/**
 * Class to manage an index of blocks and their timestamps
 *
 * ? This index only needs to start from the last report's block height, as all bundles moving forward are based on future data.
 * ? If no report exists, then the startBlockNumber is used.
 *
 * This index makes the Validator way more reliable and efficient at managing correlation between blocks and time
 */
export class TimeIndexer {
	protected _cachePath: string;
	private _db!: DB;
	// private _blockTime: number; // Calculated based on average difference between blocks.
	private _ready: boolean = false;
	private _latestBlock: number;
	private _latestTimestamp: number;
	private _running: boolean = false;

	constructor(
		homeDir: string,
		protected config: IConfig,
		protected logger: Logger
	) {
		this._cachePath = path.join(homeDir, '.logstore-time');
	}

	public get latestTimestamp() {
		return this._latestTimestamp;
	}

	public async start(): Promise<void> {
		try {
			// if(shouldClearTimeIndex){
			await fse.remove(this._cachePath);
			// }
			this._db = Database.create('time-index', this._cachePath) as DB;

			this.logger.info('Starting time indexer ...');

			const startBlock = await Managers.withSources<number>(
				this.config.sources,
				async (managers) => {
					const lastReport = await managers.report.getLastReport();
					if ((lastReport || {})?.id) {
						return lastReport.height;
					}
					const startBlockNumber = await managers.node.getStartBlockNumber();
					return startBlockNumber;
				}
			);

			this.logger.info('Start Block Number: ', startBlock);

			this._running = true;
			await this._poll(startBlock);
		} catch (e) {
			this.logger.error(`Unexpected error indexing blocks by time...`);
			this.logger.error(e);
			throw e; // Fail if there's an issue with listening to data critical to performance of validator.
		}
	}

	public stop() {
		this._running = false;
	}

	// Wait until the TimeIndex is ready
	public async ready() {
		while (true) {
			if (this._ready) {
				return true;
			}
			await sleep(1000);
		}
	}

	public find(timestamp: number) {
		const db = this.db();

		if (timestamp === 0) {
			return 0;
		}

		// If exact match, use it.
		const res = db.get(timestamp) || 0;
		if (res > 0) {
			return res;
		}
		// Create an array of diffs - indicating how far the parameter timestamp is from the current value
		const diffs = [];
		for (const { key, value } of db.getRange({
			start: timestamp - SCAN_BUFFER,
			end: timestamp + SCAN_BUFFER,
		})) {
			if (key === timestamp) {
				return value;
			}
			diffs.push({ diff: Math.abs(timestamp - key), value });
		}
		if (diffs.length === 0) {
			throw new Error('Time and Blocks have not been indexed');
		}
		// Sort by diff and value
		diffs.sort((a, b) => {
			if (a.diff < b.diff) {
				return -1;
			}
			if (a.diff > b.diff) {
				return 1;
			}
			if (a.diff === b.diff) {
				if (a.value < b.value) {
					return -1;
				}
				if (a.value < b.value) {
					return 1;
				}
			}
			return 0;
		});

		return diffs[0].value;
	}

	protected async index(timestamp: number, blockNumber: number) {
		await this.db().put(timestamp, blockNumber);
	}

	protected db() {
		if (!this._db) {
			throw new Error('Database is not initialised');
		}
		return this._db;
	}

	private async _poll(startBlock?: number) {
		const { sources } = this.config;
		try {
			const { block, timestamp, delay } = await callWithBackoffStrategy(
				async () => {
					return await Managers.withSources(
						sources,
						async (managers: Managers) => {
							const latestBlock =
								(await managers.provider.getBlockNumber()) - CONFIRMATIONS;

							const fromBlock = startBlock || latestBlock;

							const toBlock = Math.min(fromBlock, latestBlock);

							let timestamp: number = 0;
							if (toBlock !== this._latestBlock) {
								const block = await managers.provider.getBlock(toBlock);
								timestamp = block.timestamp;
							}

							const delay = toBlock === this._latestBlock ? POLL_INTERVAL : 0;

							return {
								block: toBlock,
								timestamp,
								delay,
							};
						}
					);
				},
				{ limitTimeoutMs: 5 * 60 * 1000, increaseByMs: 10 * 1000 },
				async (err: any, ctx) => {
					if (!this._running) {
						throw new NotRunningError();
					}

					this.logger.info(
						`Requesting timestamp of block was unsuccessful. Retrying in ${(
							ctx.nextTimeoutInMs / 1000
						).toFixed(2)}s ...`
					);
					this.logger.debug(standardizeJSON(err));
				}
			);

			if (timestamp === 0) {
				this._ready = true;
			} else {
				await this.index(timestamp, block);
				this._latestBlock = block;
				this._latestTimestamp = timestamp;
			}

			setTimeout(() => this._running && this._poll(block + 1), delay);
		} catch (err) {
			if (!(err instanceof NotRunningError)) {
				this.logger.error(`Failed TimeIndexer`);
				this.logger.error(standardizeJSON(err));
			}
		}
	}
}
