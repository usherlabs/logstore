import { appPackageName, appVersion } from './env-config';
import SystemMesh from './system';
import { DataItem, IRuntime, Validator, sha256 } from '@kyvejs/protocol';

let dataItemCounter = 0; // Must be reset based on reaching max_bundle_size.

export default class Runtime implements IRuntime {
	public name = appPackageName;
	public version = appVersion;

	constructor(private systemMesh: SystemMesh) {}

	// ? Producing data items here is include automatic management of local bundles, and proposed bundles.
	async getDataItem(
		core: Validator,
		source: string,
		key: string
	): Promise<DataItem> {
		dataItemCounter++;
		if (dataItemCounter === parseInt(core.pool.data!.max_bundle_size, 10)) {
			dataItemCounter = 0;
		}
		if (dataItemCounter === 0) {
			// Insert the report from system listener process.
			const report = this.systemMesh.pick();
			return {
				key,
				value: report,
			};
		}

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

	// https://github.com/KYVENetwork/Validator/blob/main/common/core/src/methods/helpers/saveGetTransformDataItem.ts#L33
	async prevalidateDataItem(_: Validator, __: DataItem): Promise<boolean> {
		// TODO: validate if signature is valid?
		return true;
	}

	// https://github.com/KYVENetwork/Validator/blob/main/common/core/src/methods/helpers/saveGetTransformDataItem.ts#L44
	async transformDataItem(_: Validator, item: DataItem): Promise<DataItem> {
		// TODO: only save content of message or metadata aswell?
		return item;
	}

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
		// TODO: save latest timestamp or nothing?
		return `${bundle.at(-1)?.value?.at(-1)?.timestamp ?? ''}`;
	}

	async nextKey(_: Validator, key: string): Promise<string> {
		return (parseInt(key) + 1000).toString(); // The larger the data item, the less items required in a bundle, otherwise increase interval.
	}
}
