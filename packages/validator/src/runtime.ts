import { LogStoreClient } from '@concertodao/logstore-client';
import { DataItem, IRuntime, sha256 } from '@kyvejs/protocol';
import { ethers } from 'ethers';

import { Managers } from './classes/Managers';
import { produceItem } from './core/item';
import { produceReport } from './core/report';
import { appPackageName, appVersion } from './env-config';
import { getConfig } from './utils/config';
import { reportPrefix } from './utils/constants';
import Validator from './validator';

export default class Runtime implements IRuntime {
	public name = appPackageName;
	public version = appVersion;

	// ? Producing data items here is include automatic management of local bundles, and proposed bundles.
	async getDataItem(
		core: Validator,
		source: string,
		key: string
	): Promise<DataItem> {
		const config = getConfig(core);
		const managers = new Managers(source, config.contracts);

		// IF REPORT
		if (key.startsWith(reportPrefix)) {
			core.logger.info(`Create Report: ${key}`);

			const report = await produceReport(core, managers, key);

			return {
				key,
				value: report,
			};
		}

		// IF NO REPORT

		const item = await produceItem(core, managers, key);

		return {
			key,
			value: [],
		};
	}

	// https://github.com/KYVENetwork/kyvejs/tree/main/common/protocol/src/methods/helpers/saveGetTransformDataItem.ts#L33
	async prevalidateDataItem(_: Validator, __: DataItem): Promise<boolean> {
		return true;
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
		const listenerCache = await core.listener.db();
		const [item] = bundle; // first data item should always be the bundle
		const itemKeyInt = parseInt(item.key, 10);
		for await (const [lKey] of listenerCache.iterator()) {
			const [key] = lKey.split(':');
			const keyInt = parseInt(key, 10);
			if (keyInt > itemKeyInt) {
				return null; // Will cause the validator to abstain from the vote
			}
			break;
		}

		// Get second last item's key
		return `${bundle.at(-2).key || ``}`;
	}

	// nextKey is called before getDataItem, therefore the dataItemCounter will be max_bundle_size when report is due.
	// https://github.com/KYVENetwork/kyvejs/blob/main/common/protocol/src/methods/main/runCache.ts#L147
	async nextKey(core: Validator, key: string): Promise<string> {
		const { itemTimeRange } = getConfig(core);

		if (key.startsWith(reportPrefix)) {
			key = key.substring(reportPrefix.length, key.length);
		}

		const keyInt = parseInt(key, 10);
		const currentKey = parseInt(core.pool.data.current_key, 10); // The key at which the bundle is starting
		const maxBundleSize = parseInt(core.pool.data.max_bundle_size, 10);
		const lastBundleKey = (maxBundleSize - 1) * itemTimeRange + currentKey;
		if (keyInt === lastBundleKey) {
			return `${reportPrefix}${key}`;
		}

		return (keyInt + itemTimeRange).toString(); // The larger the data item, the less items required in a bundle, otherwise increase interval.
	}
}
