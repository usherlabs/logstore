import { DataItem } from '@kyve/core';
import { ethers, providers } from 'ethers';
import { IRuntime, Pipeline } from '@/types';
import { Node } from '@/node';
import { POOL_CONFIG_DATA } from './utils/dummy';
import { fetchPipelines, fetchEventsFromSource } from './methods';
import { name, version } from '../package.json';

export default class Runtime implements IRuntime {
	public name = name;

	public version = version;

	protected pipelines: Pipeline[];

	public async setup() {
		// STEP 1: Fetch pipelines configuration from contracts
		this.pipelines = await fetchPipelines();

		// STEP 2: load JS contracts referenced by pipelines
		// ... TODO: interate over pipelines and pull contracts to load them as executable functions on the transformer property.

		// STEP 3: determine which pipelines are valid and should be included in ETL process
		// ...
	}

	// ? Dev note: Try/Catch should be added at more granular level
	// ? Dev note #2: getDataItem is executed inside of a while-loop, whereby a key is passed to the method for each block in a range.
	public async getDataItem(core: Node, key: string): Promise<DataItem> {
		// STEP 4: fetch actual data sources as specified from the contract
		// ? Dev note: We may need to optimise the way we read pipeline data to prevent memory overload.
		const responsePromise = this.pipelines.map(
			async ({ sources, contract }) => {
				const events = await fetchEventsFromSource(
					POOL_CONFIG_DATA,
					sources,
					key
				);
				return events;
			}
		);
		const response = await Promise.all(responsePromise);

		// STEP 5: pass data loaded into the specified transformation function
		// ...

		// STEP 6: Use responses from each transformation function to determine transactions to queue/propose, or validate/vote-on.

		// STEP 7: Return all data that will be turned
		return {
			key,
			value: 'value',
		};
	}

	public async getNextKey(key: string): Promise<string> {
		return (parseInt(key, 10) + 1).toString();
	}

	public async formatValue(value: any): Promise<string> {
		return value.hash;
	}
}
