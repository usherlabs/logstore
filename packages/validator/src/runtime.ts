import { JsonRpcProvider } from '@ethersproject/providers';
import { DataItem, sha256 } from '@kyvejs/protocol';
import ContractAddresses from '@logsn/contracts/address.json';

import { Item } from './core/item';
import { Report } from './core/report';
import { appPackageName, appVersion } from './env-config';
import { Managers } from './managers';
import { SystemListener, TimeIndexer } from './threads';
import { IConfig, IRuntimeExtended } from './types';
import Validator from './validator';

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
	public listener: SystemListener;
	public time: TimeIndexer;

	async setupThreads(core: Validator, homeDir: string) {
		this.time = new TimeIndexer(homeDir, this.config, core.logger);
		this.listener = new SystemListener(
			homeDir,
			this.config.systemStreamId,
			core.logger
		);

		await this.time.start();
		await this.listener.start();
	}

	async validateSetConfig(rawConfig: string): Promise<void> {
		const config: IConfig = JSON.parse(rawConfig);

		if (!config.sources.length) {
			throw new Error(`Config does not have any sources`);
		}

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
		// -------- Validate Data Listener Start Time --------
		// ? Only if the Pool has started already created Bundles, check to ensure that the listener.startTime < keyOfFirstItem
		// eslint-disable-next-line
		const currentKey = core.pool.data!.current_key;
		if (currentKey) {
			const keyOfFirstItem = await this.nextKey(core, currentKey);
			// Is this the first item of the bundle?
			if (keyOfFirstItem === key) {
				const keyMs = parseInt(keyOfFirstItem, 10) * 1000;
				const valid = this.listener.startTime < keyMs;
				// ? Prevent the Validator Node from passing validateDataAvailability, if listener.startTime > keyOfFirstItem
				if (!valid) {
					core.logger.warn(
						`System Listener has started after the start of the Current Bundle Proposal...`
					);
					core.logger.debug(
						`Listener.startTime (${this.listener.startTime}) > keyOfFirstItem (${keyMs})`
					);
					core.logger.info(
						`Keep the Validator running until next Bundle Proposal starts to participate in the Pool!`
					);
					return null;
				}
			}
		}

		// -------- Validate Data Availability --------
		const keyInt = parseInt(key, 10);
		if (!keyInt) {
			// ? In validateDataAvailability, the start_key is used if no Bundle current_key exists -- ie. 0
			key = await this.startKey();
		}

		// -------- Validate Time Index --------
		await this.time.ready();

		if (keyInt > this.time.latestTimestamp) {
			return null;
		}

		// -------- Produce the Data Item --------
		const item = new Item(core, this, this.config, key, key);
		await item.prepare();
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
		core.logger.info(`Create Report: ${lastItem.key}`);
		const report = new Report(
			core,
			this,
			this.config,
			firstItem.key,
			lastItem.key
		);
		await report.prepare();
		const reportData = await report.generate();
		const reportHash = sha256(Buffer.from(JSON.stringify(reportData)));

		lastItem.value.r = reportData;
		return lastItem.key + '_' + reportHash;
	}

	async startKey() {
		const startTs = await Managers.withSources<string>(
			this.config.sources,
			async (managers) => {
				const res = await managers.getBlock(
					await managers.node.getStartBlockNumber()
				);
				return res.timestamp.toString();
			}
		);
		return startTs;
	}

	// nextKey is called before getDataItem, therefore the dataItemCounter will be max_bundle_size when report is due.
	// https://github.com/KYVENetwork/kyvejs/blob/main/common/protocol/src/methods/main/runCache.ts#L147
	async nextKey(_: Validator, key: string): Promise<string> {
		let keyInt = parseInt(key, 10);

		if (!keyInt) {
			return await this.startKey();
		}

		keyInt++;
		return keyInt.toString();
	}
}
