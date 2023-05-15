import ContractAddresses from '@concertodao/logstore-contracts/address.json';
import { JsonRpcProvider } from '@ethersproject/providers';
import { DataItem, IRuntime, sha256 } from '@kyvejs/protocol';

import { Item } from './core/item';
import { Report } from './core/report';
import { appPackageName, appVersion } from './env-config';
import { IConfig } from './types';
import { reportPrefix } from './utils/constants';
import Validator from './validator';

export default class Runtime implements IRuntime {
	public name = appPackageName;
	public version = appVersion;
	public config: IConfig = {
		systemStreamId: '',
		sources: [],
		itemTimeRange: 1000,
		fees: {
			writeMultiplier: 1,
			treasuryMultiplier: 0.5, // Consumed from the Brokers by treasury for re-allocation to finance Validators
			read: 0.00000001, // value in USD
		},
	};

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

		if (!config.itemTimeRange) {
			throw new Error(`Config itemTimeRange is invalid`);
		}

		if (
			!config.fees.read ||
			!config.fees.writeMultiplier ||
			!config.fees.treasuryMultiplier
		) {
			throw new Error(`Config fee properties are invalid`);
		}

		this.config = {
			...config,
			systemStreamId: `${systemContracts.nodeManagerAddress}/system`,
		};
	}

	// ? Producing data items here is include automatic management of local bundles, and proposed bundles.
	async getDataItem(core: Validator, key: string): Promise<DataItem> {
		core.logger.debug(`getDataItem`, key);

		// IF REPORT
		if (key.startsWith(reportPrefix)) {
			core.logger.info(`Create Report: ${key}`);
			const report = new Report(core, this.config, key);
			await report.prepare();
			const value = await report.generate();

			return {
				key,
				value,
			};
		}

		// IF NO REPORT
		const item = new Item(core, this.config, key);
		await item.prepare();
		const value = await item.generate();

		return {
			key,
			value,
		};
	}

	// https://github.com/KYVENetwork/kyvejs/tree/main/common/protocol/src/methods/helpers/saveGetTransformDataItem.ts#L33
	async prevalidateDataItem(_: Validator, item: DataItem): Promise<boolean> {
		return !!item.value;
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
			Buffer.from(JSON.stringify(proposedDataItem))
		);
		const validationDataItemHash = sha256(
			Buffer.from(JSON.stringify(validationDataItem))
		);

		return proposedDataItemHash === validationDataItemHash;
	}

	async summarizeDataBundle(
		core: Validator,
		bundle: DataItem[]
	): Promise<string> {
		// First key in the listener cache is a timestamp.
		// This key must be less than the key of the first item in the bundle.
		// ie. this node may have produced an invalid report because it began listening after it had joined the processing of voting
		const [item] = bundle; // first data item should always be the bundle
		const itemKeyInt = parseInt(item.key, 10);
		if (core.listener.startTime > itemKeyInt) {
			return null; // Will cause the validator to abstain from the vote
		}

		// Get second last item's key
		return `${bundle.at(-2).key || ``}`;
	}

	// nextKey is called before getDataItem, therefore the dataItemCounter will be max_bundle_size when report is due.
	// https://github.com/KYVENetwork/kyvejs/blob/main/common/protocol/src/methods/main/runCache.ts#L147
	async nextKey(core: Validator, key: string): Promise<string> {
		const { itemTimeRange } = this.config;

		if (key.startsWith(reportPrefix)) {
			key = key.substring(reportPrefix.length, key.length);
		}

		const keyInt = parseInt(key, 10);

		const currentKey = parseInt(
			core.pool.data.current_key || core.pool.data.start_key,
			10
		); // The key at which the bundle is starting
		const maxBundleSize = parseInt(core.pool.data.max_bundle_size, 10);
		const lastBundleKey = (maxBundleSize - 1) * itemTimeRange + currentKey;

		// core.logger.debug('nextKey:', {
		// 	keyInt,
		// 	lastBundleKey,
		// 	maxBundleSize,
		// 	currentKey,
		// });

		// If the key to be produced is the lastBundleKey
		const nextKey = keyInt + itemTimeRange;
		if (nextKey === lastBundleKey) {
			return `${reportPrefix}${key}`;
		}

		return nextKey.toString(); // The larger the data item, the less items required in a bundle, otherwise increase interval.
	}
}
