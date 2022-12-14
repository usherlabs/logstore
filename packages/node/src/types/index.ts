import type {
	IRuntime as IKyveRuntime,
	ICache as IKyveCache,
	IStorageProvider as IKyveStorageProvider,
} from '@kyve/core';

export enum SupportedSourcesChains {
	mainnet = '1',
	goerli = '5',
	polygon = '137',
	polygonmum = '80001',
}

export enum SupportedSources {
	ethereum = 'ethereum',
	polygon = 'polygon',
	streamr = 'streamr',
}

export type EVMSubmitInstruction = {
	contract: string;
	method: string;
	params: (string | number | boolean)[];
};

export type SubmitInstruction = {
	polygon?: EVMSubmitInstruction[];
	ethereum?: EVMSubmitInstruction[];
};

export type TransformerResponse = {
	response?: any;
	submit?: SubmitInstruction;
};

export type SourceCache = {
	[SupportedSources.ethereum]: ISourceCache;
	[SupportedSources.polygon]: ISourceCache;
	[SupportedSources.streamr]: ISourceCache;
};

export interface ISourceCache {
	height: number;

	/**
	 * Saves the value with a key
	 *
	 * @method put
	 * @param {string} key
	 * @param {any} value
	 * @return {Promise<void>}
	 */
	put(key: string, value: any): Promise<void>;

	/**
	 * Loads the value from a key
	 *
	 * @method get
	 * @param {string} key
	 * @return {Promise<any>}
	 */
	get(key: string): Promise<any>;

	/**
	 * Checks whether a value exists for a key
	 *
	 * @method exists
	 * @param {string} key
	 * @return {Promise<boolean>}
	 */
	exists(key: string): Promise<boolean>;

	/**
	 * Deletes the value from a key
	 *
	 * @method del
	 * @param {string} key
	 * @return {Promise<void>}
	 */
	del(key: string): Promise<void>;

	/**
	 * Deletes the entire cache and therefore all values
	 *
	 * @method drop
	 * @return {Promise<void>}
	 */
	drop(): Promise<void>;

	/**
	 * Resets cache values by remove assigned `key` property which would be added during bundling
	 *
	 * @param   {number<void>}  height  [height description]
	 *
	 * @return  {<void>}                [return description]
	 */
	reset: (height: number) => Promise<void>;
}

export interface ICacheIsolate {
	get: (key: string | number) => any;
	iterator: () => AsyncGenerator<string, void, unknown>;
	exists: (key: string | number) => Promise<boolean>;
}

export interface ICache extends IKyveCache {
	db: () => Promise<any>;
	drop: (height?: number) => Promise<void>;
	isolate: (id: string) => Promise<ICacheIsolate>;
	source: (name: SupportedSources) => Promise<ISourceCache>;
}

export interface IRuntime extends IKyveRuntime {
	// setup: () => Promise<void>;
	transform: (
		pipeline: Pipeline,
		db: ICacheIsolate
	) => Promise<TransformerResponse>;
}

export interface IStorageProvider extends IKyveStorageProvider {
	retrieveBundleMetadata: (storageId: string) => Promise<string[2][]>;
}

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
	 * An identifier for the pipeline
	 */
	id: string;

	/**
	 * An array of array's which contain information about a datasource
	 * it typically contains the following
	 * the datasource name, the address of the data resource & potentially the event to filter
	 *
	 * @property sources
	 * @type {[SupportedSources, string][]}
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
	transformer?: (events: ICacheIsolate) => Promise<TransformerResponse>;
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
