import { IRuntime as IKyveRuntime, ICache as IKyveCache } from '@kyve/core';

export type SupportedDataSources = 'ethereum' | 'polygon' | 'streamr';
export type SupporedSourcesChains = '1' | '137';

export type TransformerResponse = {
	response: Object;
	submit: {
		polygon: {
			contract: string;
			method: string;
			params: (string | number)[]; // ? Dev note: We may need to expand the types that can be passed as params to the contract
		}[];
	};
};

/**
 * Interface of Pipeline
 *
 * The Pipeline is a representation of a single pipeline conguration,
 * which represents information submitted by a client as regards the
 * data sources they want to load data from and a transformer function
 * to process said data
 *
 * @interface Pipeline
 */
export interface Pipeline {
	/**
	 * An array of array's which contain information about a datasource
	 * it typically contains the following
	 * the datasource name, the address of the data resource & potentially the event to filter
	 *
	 * @property sources
	 * @type {[SupportedDataSources, string][]}
	 */
	sources: string[][];

	/**
	 * A string indicating the address of the transformer function
	 * it is typically an arweave adress as to where your pipeline js function is hosted
	 *
	 * @property contract
	 * @type {string}
	 */
	contract: string;

	/**
	 * The transformer function
	 * loaded after the pipelines contract addresses have been resolved
	 *
	 * @property transformer
	 */
	transformer?: (events: Object[]) => TransformerResponse;
}

/**
 * Interface of PoolConfig
 *
 * The PoolConfig shows the necessary keys which need to be present in the pool's configuration
 *
 * @interface PoolConfig
 */
export interface PoolConfig {
	/**
	 * A string indicating the URL to the github repo
	 *
	 * @property github
	 * @type {string}
	 */
	github?: string;
	/**
	 * An object representing the several data sources and their configurations
	 *
	 * @property sources
	 * @type {Object}
	 */
	sources: Sources;
}

export interface Sources {
	[name: string]: any;
}

export interface IRuntime extends IKyveRuntime {
	setup: () => Promise<void>;
}

export interface ICache extends IKyveCache {
	drop: (height?: number) => Promise<void>;
}
