import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { DataItem, IRuntime, sha256, Validator } from '@kyvejs/protocol';
import { ethers } from 'ethers';

import { reportContractABI } from './dummy';
import { appPackageName, appVersion } from './env-config';

const reportPrefix = `report_` as const;
const itemTimeRange = 1000 as const;

export default class Runtime implements IRuntime {
	public name = appPackageName;
	public version = appVersion;

	// ? Producing data items here is include automatic management of local bundles, and proposed bundles.
	async getDataItem(
		core: Validator,
		source: string,
		key: string
	): Promise<DataItem> {
		const [rpcUrl, reportContractAddress] = source;

		// IF REPORT
		if (key.startsWith(reportPrefix)) {
			// 1. Use unique source to Smart Contracts to determine last accepted report
			// 2. Use last accepted report to determine range between last report and this report (using key timestamp) and query for messages

			// get auth headers for proxy endpoints
			const provider = new ethers.JsonRpcProvider(rpcUrl);
			const reportManagerContract = new ethers.Contract(
				reportContractAddress,
				reportContractABI,
				{
					provider,
				}
			);
			const report = await reportManagerContract.getLastReport();
			let fromKey = 0;
			if ((report || {})?.key) {
				const rKey = report.key.substring(
					reportPrefix.length,
					report.key.length
				);
				fromKey = parseInt(rKey, 10);
			}
			const toKey = parseInt(
				key.substring(reportPrefix.length, key.length),
				10
			);

			// TODO: Query system stream from Broker Network
			// TODO: Determine based on unanimous observations which nodes missed data

			// const resp = await logStore.query('system_stream_id', { from: fromKey, to: toKey });
			const resp = [{ hello: 'world' }]; // ! DUMMY
			const queryBytesSize = JSON.stringify(resp).length;

			return {
				key,
				value: [],
			};
		}

		// IF NO REPORT
		// // Multiple sources from the Smart Contract is not even needed here
		// if (lastKey === key && lastValue !== null) {
		// 	return lastValue;
		// }

		// Range will be from last key (timestamp) to this key
		const keyVal = parseInt(key, 10);
		const range = [keyVal - itemTimeRange, keyVal]; // First iteration over the cache, will use the first nextKey -- ie. 1000

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

	async summarizeDataBundle(_: Validator, bundle: DataItem[]): Promise<string> {
		// Get last item's key
		return `${bundle.at(-1).key || ``}`;
	}

	// nextKey is called before getDataItem, therefore the dataItemCounter will be max_bundle_size when report is due.
	// https://github.com/KYVENetwork/kyvejs/blob/main/common/protocol/src/methods/main/runCache.ts#L147
	async nextKey(core: Validator, key: string): Promise<string> {
		if (key.startsWith(reportPrefix)) {
			key = key.substring(reportPrefix.length, key.length);
		}

		const keyVal = parseInt(key, 10);
		if (
			keyVal % parseInt(core.pool.data.max_bundle_size, 10) == 0 &&
			keyVal > 0 // First ever bundle does not include a report
		) {
			return `${reportPrefix}${key}`;
		}

		return (keyVal + itemTimeRange).toString(); // The larger the data item, the less items required in a bundle, otherwise increase interval.
	}
}
