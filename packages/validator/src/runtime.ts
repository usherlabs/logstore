import { DataItem } from '@kyve/core';
import { standardizeJSON, sha256 } from '@kyve/core/dist/src/utils';
import { IRuntime, Pipeline, ICacheIsolate, SupportedSources } from '@/types';
import { Node } from './node';
import { appPackageName, appVersion } from './env-config';

const itemPriorityBySource = [
	SupportedSources.streamr,
	SupportedSources.polygon,
	SupportedSources.ethereum,
];

export default class Runtime implements IRuntime {
	public name = appPackageName;

	public version = appVersion;

	// ? Dev note: Try/Catch should be added at more granular level
	// ? Dev note #2: getDataItem is executed inside of a while-loop, whereby a key is passed to the method for each block in a range.
	public async getDataItem(core: Node, key: string): Promise<DataItem> {
		// read the NEXT event from the source cache in order of priority. Move onto the next source in priority based on whether events no longer exist in cache.
		// Priority = Streamr, Polygon, Ethereum
		let source: SupportedSources;
		let sourceKey;
		for (let i = 0; i < itemPriorityBySource.length; i += 1) {
			source = itemPriorityBySource[i];

			const cache = core.getSourceCache(source);

			const height = await cache.height;
			for (let j = height - 1; j > 0; j -= 1) {
				// iterate backwards over source cache -- until an source item is fetched with a key
				const value = await cache.get(j.toString());
				if (value?.key) {
					break;
				}
				sourceKey = j; // Source key becomes the key of the item just after an item with a key
			}
		}

		if (typeof sourceKey === 'number' && typeof source === 'string') {
			const cache = core.getSourceCache(source);
			const sourceValue = await cache.get(sourceKey.toString());
			const value = {
				...sourceValue,
				source,
			};
			await cache.put(sourceKey.toString(), {
				...sourceValue,
				key,
			});

			// return the data into the bundle using the key
			// ? Dev note: Imagine that all the bundles combine form an append-only event log
			// ? -- The key would represent the event to fetch from that append-only event log, and the height range would determine the bundle to extract from that event log.
			return {
				key,
				value,
			};
		}

		return {
			key: '',
			value: '',
		};
	}

	/**
	 * A method to use the an instance of the events database layer to produce a read-only version specifically for the pipeline transformer.
	 */
	public async transform(pipeline: Pipeline, db: ICacheIsolate) {
		return pipeline.transformer(db);
	}

	async validate(
		core: Node,
		uploadedBundle: DataItem[],
		validationBundle: DataItem[]
	) {
		const uploadedBundleHash = sha256(
			Buffer.from(JSON.stringify(uploadedBundle))
		);
		const validationBundleHash = sha256(
			Buffer.from(JSON.stringify(validationBundle))
		);

		core.logger.debug(`Validating bundle proposal by hash`);
		core.logger.debug(`Uploaded:     ${uploadedBundleHash}`);
		core.logger.debug(`Validation:   ${validationBundleHash}\n`);

		return uploadedBundleHash === validationBundleHash;
	}

	public async getNextKey(key: string): Promise<string> {
		return (parseInt(key, 10) + 1).toString();
	}

	public async formatValue(value: any): Promise<string> {
		if (value.hash) {
			return value.hash;
		}

		let v = value;
		if (typeof v === 'object') {
			v = standardizeJSON(v);
		}
		return sha256(v);
	}
}
