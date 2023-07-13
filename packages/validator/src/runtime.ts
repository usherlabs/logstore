import { JsonRpcProvider } from '@ethersproject/providers';
import { DataItem, sha256, sleep } from '@kyvejs/protocol';
import ContractAddresses from '@logsn/contracts/address.json';

import { Item } from './core/item';
import { Report } from './core/report';
import { appPackageName, appVersion } from './env-config';
import { Managers } from './managers';
import { ChainSources } from './sources';
import { EventsIndexer, SystemListener, TimeIndexer } from './threads';
import { IConfig, IRuntimeExtended } from './types';
import { Slogger } from './utils/slogger';
import Validator from './validator';

export const KEY_STEP = 20 as const;

export default class Runtime implements IRuntimeExtended {
	public name = appPackageName;
	public version = appVersion;
	public config: IConfig = {
		systemStreamId: '',
		sources: [],
		fees: {
			writeMultiplier: 1,
			treasuryMultiplier: 0.5, // Consumed from the Brokers by treasury for re-allocation to finance Validators
			readMultiplier: 0.05, // 5% of the write. For comparison AWS Serverless DynamoDB read fees are 20% of the write fees, prorated to the nearest 4kb
		},
	};
	public chain: ChainSources;
	public listener: SystemListener;
	public time: TimeIndexer;
	public events: EventsIndexer;
	public managers: Managers;
	private _startKey: number;
	private _startBlockNumber: number;

	async setup(core: Validator, homeDir: string) {
		Slogger.register(core.logger);
		core.logger.debug('Home Directory:', homeDir);

		this.chain = new ChainSources(this.config.sources);
		const startBlock = await this.startBlockNumber();

		this.events = new EventsIndexer(
			homeDir,
			core.pool.id,
			startBlock,
			this.chain,
			core.lcd,
			core.logger
		);
		this.time = new TimeIndexer(homeDir, startBlock, this.chain, core.logger);
		this.listener = new SystemListener(
			homeDir,
			this.config.systemStreamId,
			core.logger
		);

		this.managers = new Managers(this.chain, this.events);
	}

	async runThreads() {
		await this.time.start();
		await this.listener.start();
		await this.events.start();
	}

	async ready(core: Validator, syncPoolState: () => Promise<void>) {
		const getCurrentKeyMs = async () => {
			/* eslint-disable */
			const nextKey = core.pool.data!.current_key
				? await this.nextKey(core, core.pool.data!.current_key)
				: core.pool.data!.start_key;
			/* eslint-enable */

			return parseInt(nextKey, 10) * 1000;
		};

		const listenerHasValidData = async () => {
			let currentKeyMs = await getCurrentKeyMs();
			if (!currentKeyMs) {
				// If the pool hasn't started yet, then this check can pass.
				return;
			}
			// If the pool has started, then the currentKey > listener.startTime to proceed. ie. Listener should start before the start of the bundle.
			while (
				!this.listener.startTime ||
				this.listener.startTime > currentKeyMs
			) {
				if (!this.listener.startTime) {
					core.logger.info(
						'SystemListener is not started yet. Sleeping for 10 seconds...'
					);
					await sleep(10 * 1000);
				} else {
					const sleepMs = this.listener.startTime - currentKeyMs + 1000;
					core.logger.info(
						`SystemListener.startTime (${
							this.listener.startTime
						}) is greater than currentKeyMs (${currentKeyMs}). Sleeping for ${(
							sleepMs / 1000
						).toFixed(2)} seconds...`
					);
					await sleep(sleepMs);
				}
				await syncPoolState();
				currentKeyMs = await getCurrentKeyMs();
			}
		};

		await Promise.all([
			this.time.ready(),
			this.events.ready(),
			listenerHasValidData(),
		]);
	}

	async validateSetConfig(rawConfig: string): Promise<void> {
		const config: IConfig = JSON.parse(rawConfig);

		if (!config.sources.length) {
			throw new Error(`Config does not have any sources`);
		}

		// TODO: Remove this source from the on-chain PoolConfig
		config.sources = config.sources.filter(
			(source) => !source.includes('polygon-bor.publicnode.com')
		);

		let chainId = null;
		for (const source of config.sources) {
			const provider = new JsonRpcProvider(source);
			const network = await provider.getNetwork();
			if (typeof chainId !== 'number') {
				chainId = network.chainId;
			} else if (chainId !== network.chainId) {
				throw new Error(
					`Config sources have different network chain identifiers`
				);
			}
		}
		const systemContracts = ContractAddresses[chainId];
		if (typeof systemContracts === 'undefined') {
			throw new Error(`Config sources have invalid network chain identifier`);
		}

		this.config = {
			...this.config,
			...config,
			systemStreamId: `${systemContracts.nodeManagerAddress}/system`,
		};
	}

	// * Data items are produced here for the bundle in local cache. The local bundle is then used for voting on proposed bundles, and creating new bundle proposals?
	async getDataItem(core: Validator, key: string): Promise<DataItem> {
		const keyInt = parseInt(key, 10);
		if (!keyInt) {
			return { key, value: { m: [] } };
		}

		if (keyInt > this.time.latestTimestamp) {
			core.logger.info(
				'Key is greater than last indexed block/timestamp. Failing prevalidation to retry...'
			);
			return null;
		}

		// -------- Produce the Data Item --------
		const fromKey = (keyInt - KEY_STEP).toString();
		const item = new Item(this, core.logger, fromKey, key);
		const messages = await item.generate();

		return {
			key,
			value: { m: messages },
		};
	}

	// https://github.com/KYVENetwork/kyvejs/tree/main/common/protocol/src/methods/helpers/saveGetTransformDataItem.ts#L33
	async prevalidateDataItem(_: Validator, item: DataItem): Promise<boolean> {
		return item && !!item.value;
	}

	// https://github.com/KYVENetwork/kyvejs/tree/main/common/protocol/src/methods/helpers/saveGetTransformDataItem.ts#L44
	async transformDataItem(_: Validator, item: DataItem): Promise<DataItem> {
		return item;
	}

	// Check if data items from different sources are the same. Fantastic 👏
	async validateDataItem(
		_: Validator,
		proposedDataItem: DataItem,
		validationDataItem: DataItem
	): Promise<boolean> {
		const proposedDataItemHash = sha256(
			Buffer.from(JSON.stringify(proposedDataItem.value.m))
		);
		const validationDataItemHash = sha256(
			Buffer.from(JSON.stringify(validationDataItem.value.m))
		);

		return proposedDataItemHash === validationDataItemHash;
	}

	async summarizeDataBundle(
		core: Validator,
		bundle: DataItem[]
	): Promise<string> {
		const firstItem = bundle.at(0);
		const lastItem = bundle.at(-1);

		const summary = [lastItem.key];

		core.logger.info(`Create Report: ${lastItem.key}`);
		const bundleStartKey =
			firstItem.key === '0'
				? '0'
				: (parseInt(firstItem.key, 10) - KEY_STEP).toString();
		const report = new Report(this, core.logger, bundleStartKey, lastItem.key);
		const systemReport = await report.generate();
		const reportData = systemReport.serialize();
		const reportHash = sha256(Buffer.from(JSON.stringify(reportData))); // use sha256 of entire report to include report.events.
		core.logger.debug(`Report hash generated: ${reportHash}`);
		lastItem.value.r = reportData;
		summary.push(reportHash);

		core.logger.info(`Create Events: ${lastItem.key}`);
		const eventsForColdStore = this.events.prepare(true);
		console.log(eventsForColdStore);
		if (eventsForColdStore.length > 0) {
			core.logger.debug(
				`${eventsForColdStore.length} events prepared for cold storage`
			);
			const eventsHash = sha256(
				Buffer.from(JSON.stringify(eventsForColdStore))
			);
			lastItem.value.e = eventsForColdStore;
			summary.push(eventsHash);
		}

		return summary.join('_');
	}

	async startKey(): Promise<number> {
		if (!this._startKey) {
			this._startKey = await this.chain.getTimestampByBlock(
				await this.startBlockNumber()
			);
		}

		return this._startKey;
	}

	async startBlockNumber(): Promise<number> {
		if (!this._startBlockNumber) {
			this._startBlockNumber = await this.chain.getStartBlockNumber();
		}

		return this._startBlockNumber;
	}

	// nextKey is called before getDataItem, therefore the dataItemCounter will be max_bundle_size when report is due.
	// https://github.com/KYVENetwork/kyvejs/blob/main/common/protocol/src/methods/main/runCache.ts#L147
	async nextKey(core: Validator, key: string): Promise<string> {
		let keyInt = parseInt(key, 10);

		if (!keyInt) {
			const startKey = await this.startKey();
			core.logger.info(`Log Store Network Start key: ${startKey}`);
			return startKey.toString();
		}

		keyInt += KEY_STEP;

		return keyInt.toString();
	}
}
