import { appPackageName, appVersion } from './env-config';
import { DataItem, IRuntime, Validator, sha256 } from '@kyvejs/protocol';

const reportPrefix = `report_` as const;
let iterations = 0; // Must be reset based on reaching max_bundle_size.
let lastKey = '';
let lastDataItem: DataItem | null = null;

export default class Runtime implements IRuntime {
	public name = appPackageName;
	public version = appVersion;

	// ? Producing data items here is include automatic management of local bundles, and proposed bundles.
	async getDataItem(
		core: Validator,
		source: string,
		key: string
	): Promise<DataItem> {
		const createItem = (item: DataItem) => {
			if (lastKey !== key) {
				lastKey = key;
			}
			lastDataItem = item;
			return item;
		};

		// IF REPORT
		if (key.startsWith(reportPrefix)) {
			// 1. Use unique source to Smart Contracts to determine last accepted report
			// 2. Use last accepted report to determine range between last report and this report (using key timestamp) and query for messages

			const lastReportTimestamp = Date.now() - 1999999999;
			const range = [
				lastReportTimestamp,
				parseInt(key.substring(reportPrefix.length, key.length), 10),
			];
			// TODO: Query system stream from Broker Network
			// TODO: Determine based on unanimous observations which nodes missed data

			return createItem({
				key,
				value: [],
			});
		}

		// IF NO REPORT
		// Multiple sources from the Smart Contract is not even needed here
		if (lastKey === key && lastDataItem !== null) {
			return lastDataItem;
		}
		// Range will be from last key (timestamp) to this key
		const range = [parseInt(lastKey, 10), parseInt(key, 10)];

		// TODO: Fetch batch items from broker Validators
		// TODO: Unify data items that share the same content and timestamps.
		// const streamr = new StreamrClient();
		// const group = [];

		// const fromTimestamp = parseInt(key);
		// const toTimestamp = parseInt(await this.nextKey(core, key));

		// if (Date.now() < toTimestamp) {
		//   throw new Error('reached live limit');
		// }

		// const stream = await streamr.resend(source, {
		//   from: {
		//     timestamp: fromTimestamp,
		//   },
		//   to: {
		//     timestamp: toTimestamp,
		//   },
		// });

		// for await (const item of stream) {
		//   group.push(item);
		// }

		return createItem({
			key,
			value: [],
		});
	}

	// https://github.com/KYVENetwork/Validator/blob/main/common/core/src/methods/helpers/saveGetTransformDataItem.ts#L33
	async prevalidateDataItem(_: Validator, __: DataItem): Promise<boolean> {
		return true;
	}

	// https://github.com/KYVENetwork/Validator/blob/main/common/core/src/methods/helpers/saveGetTransformDataItem.ts#L44
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

	async summarizeDataBundle(_: Validator, bundle: DataItem[]): Promise<string> {
		// Get last item's key
		return `${bundle.at(-1).key || ``}`;
	}

	// nextKey is called before getDataItem, therefore the dataItemCounter will be max_bundle_size when report is due.
	// https://github.com/KYVENetwork/kyvejs/blob/main/common/protocol/src/methods/main/runCache.ts#L147
	async nextKey(core: Validator, key: string): Promise<string> {
		iterations++;
		if (iterations === parseInt(core.pool.data.max_bundle_size, 10)) {
			iterations = 0;
			return `${reportPrefix}${key}`;
		}
		if (key.startsWith(reportPrefix)) {
			key = key.substring(reportPrefix.length, key.length);
		}
		return (parseInt(key, 10) + 1000).toString(); // The larger the data item, the less items required in a bundle, otherwise increase interval.
	}
}
