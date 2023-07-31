import { sha256 } from '@kyvejs/protocol';
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
type Timestamp = number;
type DB = RootDatabase<
	{
		b: BlockNumber;
		s: string[]; // Sources that agree
	},
	Timestamp
>;

const CONFIRMATIONS = 128 as const; // The number of confirmations/blocks required to determine finality.
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
export class TimeIndexer {
	protected _cachePath: string;
	private _db!: DB;
	private _running: boolean = false;
	private _latestTimestamp: number;
	private _childProcesses: ChildProcess[] = [];

	constructor(
		private startTimestamp: number,
		homeDir: string,
		protected config: IConfig,
		protected logger: Logger
	) {
		this._cachePath = path.join(homeDir, '.logstore-time');

		if (!shell.which('ethereumetl')) {
			throw new Error(
				'ethereumetl is not installed. Please re-install the Log Store Validator, or run `pip install ethereum-etl`'
			);
		}
	}

	public get latestTimestamp() {
		return this._latestTimestamp;
	}

	public async start(): Promise<void> {
		this._running = true;

		try {
			await fse.remove(this._cachePath);

			const dbPath = path.join(this._cachePath, 'cache');

			// ? For testing purposes
			if (copyFromTimeIndex) {
				this.logger.info(`Copy from an existing Time Index`);
				const exists = await fse.pathExists(copyFromTimeIndex);
				if (!exists) {
					throw new Error('Time Index to copy from does not exist');
				}
				const existingTimeIndex = path.join(copyFromTimeIndex, 'cache');
				await fse.copySync(existingTimeIndex, dbPath);
			}

			this._db = Database.create('time-index', dbPath) as DB;

			this.logger.info('Starting time indexer ...');

			const startBlock = await Managers.withSources<number>(
				async (managers) => {
					if (this.startTimestamp) {
						return await managers.findBlock(this.startTimestamp);
					} else {
						return await managers.node.getStartBlockNumber();
					}
				}
			);

			this.logger.info('Start Block Number: ', startBlock);

			await this.etl(startBlock);
		} catch (e) {
			this.logger.error(`Unexpected error indexing blocks by time...`);
			this.logger.error(e);
			throw e; // Fail if there's an issue with listening to data critical to performance of validator.
		}
	}

	public stop() {
		this._running = false;
		this._childProcesses.forEach((child) => {
			child.kill();
		});
	}

	public find(timestamp: number): number {
		const db = this.db();

		if (timestamp === 0) {
			return 0;
		}

		// Search for the nearest block with timestamp greater than the given
		const res =
			db.getRange({ start: timestamp, limit: 1 }).asArray[0]?.value ||
			DEFAULT_DB_VALUE;

		if (res.b > 0 && res.s.length > 0) {
			return res.b;
		} else {
			throw new Error('Could not find time indexed blocks for timestamp');
		}
	}

	protected db() {
		if (!this._db) {
			throw new Error('Database is not initialised');
		}
		return this._db;
	}

	private async etl(startBlock?: number) {
		const { sources } = this.config;
		const db = this.db();
		this.logger.debug(`Start ETL from block ${startBlock || `'latest'`} ...`);

		for (let i = 0; i < sources.length; i++) {
			const run = async (source: string) => {
				const saveFilename = `last_synced_block_${sha256(
					Buffer.from(source)
				)}.txt`;
				const savefile = path.join(this._cachePath, saveFilename);
				await fse.remove(savefile);
				const managers = new Managers(source);
				await managers.init();
				const latestBlock =
					(await managers.provider.getBlockNumber()) - CONFIRMATIONS;
				const fromBlock = startBlock || latestBlock;

				const child = spawn(shell.which('ethereumetl').toString(), [
					'stream',
					'-s',
					fromBlock.toString(),
					'-e',
					'block',
					'-p',
					source,
					'-l',
					savefile,
					'--period-seconds',
					POLL_INTERVAL.toString(),
					'-b',
					BATCH_SIZE.toString(),
					'--lag',
					CONFIRMATIONS.toString(),
				]);

				this._childProcesses.push(child);

				this.logger.debug(`TimeIndexer (${source}) PID:`, child.pid);

				child.stderr.on('data', (buff) => {
					const data = buff.toString();
					if (data.includes(`[INFO]`)) {
						// Skip logs that aren't root of command
						if (data.includes(`Nothing to sync`)) {
							this.logger.info(`TimeIndexer (${source}):`, data);
						} else if (
							data.includes(`Writing last synced block`) ||
							data.includes(`Current block`)
						) {
							this.logger.debug(`TimeIndexer (${source}):`, data);
						}
					} else {
						this.logger.error(`TimeIndexer (${source}):`, data);
						throw new Error('TimeIndexer Error');
					}
				});

				let buffer: string = '';
				child.stdout.on('data', async (buff) => {
					const data = buff.toString();
					buffer += data.toString();
					const entries = buffer.split('\n');
					buffer = entries.splice(-1)[0];

					for (const entry of entries) {
						let block: number;
						let timestamp: number;
						try {
							if (entry.includes(`"type": "block"`)) {
								const json = JSON.parse(entry);
								block = parseInt(json.number);
								timestamp = parseInt(json.timestamp);
							}
						} catch (e) {
							// ...
						}

						if (block && timestamp) {
							await db.transaction(() => {
								const value = db.get(timestamp) || DEFAULT_DB_VALUE;
								if (value.b === 0 && value.s.length === 0) {
									return db.put(timestamp, { b: block, s: [source] });
								} else if (value.b !== block) {
									this.logger.error(
										`TimeIndexer (${source}): Sources returned different results`,
										{
											databaseValue: value,
											newValue: {
												source,
												block,
												timestamp,
											},
										}
									);
									throw new Error(`Sources returned different results`);
								} else {
									return db.put(timestamp, {
										b: block,
										s: [...value.s, source],
									});
								}
							});

							this.logger.debug(
								`TimeIndexer (${source}): Indexed ${
									db.get(timestamp).b
								} at time ${timestamp}`
							);
							const blocksIndexedSinceStart = block - fromBlock;
							if (
								blocksIndexedSinceStart % 100 === 0 &&
								blocksIndexedSinceStart > 0
							) {
								this.logger.info(
									`TimeIndexer (${source}): Indexed ${blocksIndexedSinceStart} blocks`
								);
							}

							this._latestTimestamp = timestamp;
						} else {
							// Log message here to indicate that there was an output by the process' stdout -- but that nothing was indexed.
							this.logger.debug(
								`TimeIndexer (${source}): Data received on process stdout but nothing indexed!`,
								data
							);
						}
					}
				});

				child.on('exit', async (code) => {
					this.logger.debug(
						`TimeIndexer (${source}) exited with code: ${code}`
					);
					if (this._running) {
						this.logger.debug(`TimeIndexer (${source}) restarting...`);
						this._childProcesses[i] = await run(source);
					}
				});

				return child;
			};

			this._childProcesses[i] = await run(sources[i]);
		}
	}
}
