import { DataItem, IRuntime, Node } from "@kyve/core";
import { ethers, providers } from "ethers";
import { POOL_CONFIG_DATA } from "./utils/dummy";
import { fetchPipelines, fetchEventsFromSource } from "./methods";
import ".";

import { name, version } from "../package.json";

export default class Runtime implements IRuntime {
	public name = name;
	public version = version;

	public async getDataItem(core: Node, key: string): Promise<DataItem> {
		try {
			// STEP 1: Fetch pipelines configuration from contracts
			const pipelines = await fetchPipelines();
			// STEP 2: fetch actual data sources as specified from the contract
			const responsePromise = pipelines.map(async ({ sources, contract }) => {
				const events = await fetchEventsFromSource(
					POOL_CONFIG_DATA,
					sources,
					key
				);
			});
			const response = await Promise.all(responsePromise);
			// STEP 3: pass data loaded into the speecified transformation function

			// STEP 4: coming soon ...
			return {
				key,
				value: "value"
			};
		} catch (error) {
			throw error;
		}
	}

	public async getNextKey(key: string): Promise<string> {
		return (parseInt(key) + 1).toString();
	}

	public async formatValue(value: any): Promise<string> {
		return value.hash;
	}
}
