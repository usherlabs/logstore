import { abi as NodeManagerContractABI } from '@concertodao/logstore-contracts/artifacts/src/NodeManager.sol/LogStoreNodeManager.json';
import { abi as ReportManagerContractABI } from '@concertodao/logstore-contracts/artifacts/src/ReportManager.sol/LogStoreReportManager.json';
import { abi as StoreManagerContractABI } from '@concertodao/logstore-contracts/artifacts/src/StoreManager.sol/LogStoreManager.json';
import { DataItem, IRuntime, sha256 } from '@kyvejs/protocol';
import { ethers, EventLog } from 'ethers';

import { appPackageName, appVersion } from './env-config';
import { PoolConfig, Report } from './types';
import Validator from './validator';

const reportPrefix = `report_` as const;

const getConfig = (core: Validator): PoolConfig => {
	return {
		itemTimeRange: 1000,
		...core.poolConfig,
		fees: {
			writeMultiplier: 1,
			treasuryMultiplier: 0.2,
			read: 0.01,
			...(core.poolConfig.fees || {}),
		},
	};
};

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

		// IF REPORT
		if (key.startsWith(reportPrefix)) {
			// 1. Use unique source to Smart Contracts to determine last accepted report
			// 2. Use last accepted report to determine range between last report and this report (using key timestamp) and query for messages

			// get auth headers for proxy endpoints
			const provider = new ethers.JsonRpcProvider(source);
			const { contracts, fees } = config;

			const reportManagerContract = new ethers.Contract(
				contracts.reportManager.address,
				ReportManagerContractABI,
				{
					provider,
				}
			);
			const nodeManagerContract = new ethers.Contract(
				contracts.nodeManager.address,
				NodeManagerContractABI,
				{
					provider,
				}
			);
			const storeManagerContract = new ethers.Contract(
				contracts.storeManager.address,
				StoreManagerContractABI,
				{
					provider,
				}
			);
			const lastReport: Report = await reportManagerContract.getLastReport();
			let fromKey = 0;
			if ((lastReport || {})?.id) {
				const rKey = lastReport.id.substring(
					reportPrefix.length,
					lastReport.id.length
				);
				fromKey = parseInt(rKey, 10);
			}
			const toKey = parseInt(
				key.substring(reportPrefix.length, key.length),
				10
			);

			// Get all latest state from Smart Contract
			// We do this by using the key (timestamp) to determine the most relevant block
			// ? toKey will be a recent timestamp as the Pool's start_key will be the timestamp the Pool was created.
			let blockNumber = await provider.getBlockNumber();
			let blockNumberTimestamp = 0;
			do {
				const block = await provider.getBlock(blockNumber);
				blockNumberTimestamp = block.timestamp;
				blockNumber--;
			} while (blockNumberTimestamp > toKey);
			blockNumber++; // re-add the removed latest block
			// Now that we have the block that most closely resemble the current key
			// Fetch all Smart Contract events to reconstruct the state
			const storeUpdateEvents = await storeManagerContract.queryFilter(
				storeManagerContract.filters.StoreUpdated(),
				0,
				blockNumber
			);
			const stores: { id: string; amount: number }[] = [];
			storeUpdateEvents.forEach((e) => {
				if (!(e instanceof EventLog)) {
					return;
				}
				const storeId = e.args.getValue('store');
				const amount = e.args.getValue('amount');
				const sIndex = stores.findIndex((s) => s.id === storeId);
				if (sIndex < 0) {
					stores.push({
						id: storeId,
						amount,
					});
					return;
				}
				stores[sIndex].amount += amount;
			});
			const dataStoredEvents = await storeManagerContract.queryFilter(
				storeManagerContract.filters.DataStored(),
				0,
				blockNumber
			);
			dataStoredEvents.forEach((e) => {
				if (!(e instanceof EventLog)) {
					return;
				}
				const storeId = e.args.getValue('store');
				const amount = e.args.getValue('fees');
				const sIndex = stores.findIndex((s) => s.id === storeId);
				if (sIndex >= 0) {
					stores[sIndex].amount -= amount;
				}
			});

			// TODO: Query system stream from Broker Network
			// TODO: Determine based on unanimous observations which nodes missed data

			for (let i = 0; i < stores.length; i++) {
				// 1. Get the query partition for this specific store -- this should be a public method
				// 2. Query the store using its query partition
				// 3. Query the query partition for the system stream to fetch all read related metadata
				// const resp = await logStore.query('system_stream_id', { from: fromKey, to: toKey });
			}
			// const resp = await logStore.query('system_stream_id', { from: fromKey, to: toKey });
			// const resp = await logStore.query('system_stream_id', { from: fromKey, to: toKey });
			const resp = [{ hello: 'world' }]; // ! DUMMY
			const queryBytesSize = JSON.stringify(resp).length;

			const report: Report = {
				id: key,
				height: blockNumber,
				streams: [],
				consumers: [],
				nodes: {},
				delegates: {},
			};

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
		const range = [keyVal - config.itemTimeRange, keyVal]; // First iteration over the cache, will use the first nextKey -- ie. 1000

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

	async summarizeDataBundle(
		core: Validator,
		bundle: DataItem[]
	): Promise<string> {
		// First key in the cache is a timestamp that is comparable to the bundle start key -- ie. Node must have a timestamp < bundle_start_key
		const listenerCache = await core.listener.db();
		const [report] = bundle; // first data item should always be the bundle
		const rKey = report.key.substring(reportPrefix.length, report.key.length);
		const rKeyInt = parseInt(rKey, 10);
		for await (const [key] of listenerCache.iterator()) {
			const keyInt = parseInt(key, 10);
			if (keyInt >= rKeyInt) {
				return null; // Will cause the validator to abstain from the vote
			}
			break;
		}

		// Get last item's key
		return `${bundle.at(-1).key || ``}`;
	}

	// nextKey is called before getDataItem, therefore the dataItemCounter will be max_bundle_size when report is due.
	// https://github.com/KYVENetwork/kyvejs/blob/main/common/protocol/src/methods/main/runCache.ts#L147
	async nextKey(core: Validator, key: string): Promise<string> {
		const { itemTimeRange } = getConfig(core);

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
