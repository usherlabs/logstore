import { sha256 } from '@kyvejs/protocol';
import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import fse from 'fs-extra';
import type { RootDatabase } from 'lmdb';
import path from 'path';
import { BehaviorSubject, filter, firstValueFrom } from 'rxjs';
import shell from 'shelljs';
import type { Logger } from 'tslog';

import { copyFromTimeIndex } from '../env-config';
import { ChainSources } from '../sources';
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
	private isReadySubject = new BehaviorSubject(false);

	constructor(
		homeDir: string,
		protected startBlockNumber: number,
		protected chain: ChainSources,
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

	private markAsReady(): void {
		this.isReadySubject.next(true);
		this.logger.debug('Time Indexer: Ready!');
	}

	public async ready() {
		return firstValueFrom(
			this.isReadySubject.pipe(filter((ready) => ready === true))
		);
	}

	public async start(): Promise<void> {
		this._running = true;

		try {
			// await fse.remove(this._cachePath);

			let startBlock = this.startBlockNumber;
			const dbPath = path.join(this._cachePath, 'cache');

			// ? For testing purposes
			if (copyFromTimeIndex) {
				this.logger.info(`Copy from an existing Time Index`);
				const exists = await fse.pathExists(copyFromTimeIndex);
				if (!exists) {
					throw new Error('Time Index to copy from does not exist');
				}
				const existingTimeIndex = path.join(copyFromTimeIndex, 'cache');
				fse.copySync(existingTimeIndex, dbPath);
			}

			this._db = Database.create('time-index', dbPath) as DB;

			// ? If the index already exists, check it's latest data.
			for (const { key, value } of this._db.getRange({
				reverse: true,
				limit: 1,
			})) {
				this.logger.debug(
					`Fetch last Time Index item - ${key}: ${value.b} (${value.s.join(
						','
					)})`
				);
				this._latestTimestamp = key;
				startBlock = value.b;
			}

			this.logger.info('Starting TimeIndexer ...');

			const lastReportHeight = await this.chain.use(async (source) => {
				const contract = await source.contracts.report();
				const lastReport = await contract.getLastReport();
				if ((lastReport || {})?.id) {
					return lastReport.height;
				}
				return null;
			});
			if (lastReportHeight) {
				startBlock = lastReportHeight.toNumber();
			}

			this.logger.info('TimeIndexer: Start Block Number: ', startBlock);

			await this.etl(startBlock);
			this.markAsReady();
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
			throw new Error(
				'Could not find time indexed blocks for timestamp: ' + timestamp
			);
		}
	}

	protected db() {
		if (!this._db) {
			throw new Error('Database is not initialized');
		}
		return this._db;
	}

	private async etl(startBlock?: number) {
		const db = this.db();
		const sources = this.chain.sources;

		this.logger.debug(
			`Start ETL from block ${
				startBlock || `'latest'`
			} with sources ${sources.join(', ')}...`
		);

		for (let i = 0; i < sources.length; i++) {
			const run = async (source: string) => {
				const saveFilename = `last_synced_block_${sha256(
					Buffer.from(source)
				)}.txt`;
				const savefile = path.join(this._cachePath, saveFilename);
				await fse.remove(savefile);

				const provider = this.chain.getProvider(source);
				if (!provider) {
					throw new Error('Invalid source used to get Provider in TimeIndexer');
				}

				const latestBlock = (await provider.getBlockNumber()) - CONFIRMATIONS;
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

				let stderr: string = '';
				child.stderr.on('data', (buff) => {
					const data = buff.toString();
					stderr += data.toString();
					const entries = stderr.split('\n');
					stderr = entries.splice(-1)[0];

					for (const entry of entries) {
						if (entry.includes(`[INFO]`)) {
							// Skip logs that aren't root of command
							if (entry.includes(`Nothing to sync`)) {
								this.logger.info(`TimeIndexer (${source}):`, entry);
							} else if (
								entry.includes(`Writing last synced block`) ||
								entry.includes(`Current block`)
							) {
								this.logger.silly(`TimeIndexer (${source}):`, entry);
							}
						} else {
							this.logger.error(`TimeIndexer (${source}):`, entry);
							throw new Error('TimeIndexer Error');
						}
					}
				});

				let stdout: string = '';
				child.stdout.on('data', async (buff) => {
					const data = buff.toString();
					stdout += data.toString();
					const entries = stdout.split('\n');
					stdout = entries.splice(-1)[0];

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

							this.logger.silly(
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
