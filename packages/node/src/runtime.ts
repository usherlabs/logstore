import { DataItem } from '@kyve/core';
import { standardizeJSON, sha256 } from '@kyve/core/dist/src/utils';
import { IRuntime, Pipeline, ICacheIsolate } from '@/types';
import { Node } from '@/node';
import { appPackageName, appVersion } from './env-config';

export default class Runtime implements IRuntime {
	public name = appPackageName;

	public version = appVersion;

	// ? Dev note: Try/Catch should be added at more granular level
	// ? Dev note #2: getDataItem is executed inside of a while-loop, whereby a key is passed to the method for each block in a range.
	public async getDataItem(core: Node, key: string): Promise<DataItem> {
		// STEP 5: read and delete the NEXT event from the source cache in order of priority. Move onto the next source in priority based on whether events no longer exist in cache.
		// Priority = Streamr, Polygon, Ethereum

		// ? Dev note: We may need to optimise the way we read pipeline data to prevent memory overload.
		// const responsePromise = pipelines.map(
		// 	async ({ sources, contract }) => {
		// 		const events = await fetchEventsFromSource(
		// 			POOL_CONFIG_DATA,
		// 			sources,
		// 			key
		// 		);
		// 		return events;
		// 	}
		// );
		// const response = await Promise.all(responsePromise);

		// STEP 6: return the data into the bundle using the key
		// ? Dev note: Imagine that all the bundles combine form an append-only event log
		// ? -- The key would represent the event to fetch from that append-only event log, and the height range would determine the bundle to extract from that event log.
		return {
			key,
			value: 'event', // TODO: Be sure to include the `source` inside of the event -- could even be { source: "streamr", pipeline: "pipeline_hash_identifier", e: event }
		};
	}

	/**
	 * A method to use the an instance of the events database layer to produce a read-only version specifically for the pipeline transformer.
	 */
	public async transform(pipeline: Pipeline, db: ICacheIsolate) {
		return pipeline.transformer(db);
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
