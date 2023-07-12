/**
 * We want to isolate how sources are iterated and aggregated into a single process.
 *
 * This class with abstract all on-chain interacts and wrap each interaction with an iteration and aggration.
 * This way the managers can aggregate data across indexers and direct chain sources
 */
import { JsonRpcProvider, Provider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import {
	LogStoreManager,
	LogStoreNodeManager,
	LogStoreReportManager,
} from '@logsn/contracts';
import {
	getNodeManagerContract,
	getReportManagerContract,
	getStoreManagerContract,
} from '@logsn/shared';
import { cloneDeep } from 'lodash';

import { getEvmPrivateKey } from '../env-config';

const clean = (value: object) => {
	if (!value) return value;

	if (Array.isArray(value)) {
		for (const item of value) {
			clean(item);
		}
	}

	// if the object has "provider" property with "connection" property then delete the "provider"
	if (typeof value === 'object') {
		for (const key of Object.keys(value)) {
			if (key === 'provider' && value[key].connection) {
				delete value[key];
			} else {
				clean(value[key]);
			}
		}
	}

	return value;
};

export interface IChainSource {
	provider: JsonRpcProvider;
	contracts: {
		node: () => Promise<LogStoreNodeManager>;
		report: () => Promise<LogStoreReportManager>;
		store: () => Promise<LogStoreManager>;
	};
}

export class ChainSources {
	private _sources: IChainSource[];

	constructor(sources: string[]) {
		for (const source of sources) {
			const provider = new JsonRpcProvider(source);
			const priv = getEvmPrivateKey();
			const wallet = new Wallet(priv, provider);
			this._sources.push({
				provider,
				contracts: {
					node: () => getNodeManagerContract(wallet),
					report: () => getReportManagerContract(wallet),
					store: () => getStoreManagerContract(wallet),
				},
			});
		}
	}

	/**
	 * Method to accept a callback and produce a provider.
	 */
	public async use<T>(fn: (source: IChainSource) => Promise<T>): Promise<T> {
		const results = await Promise.all(
			this._sources.map(async (source) => {
				return await fn(source);
			})
		);
		return this.aggregate(results);
	}

	private aggregate(results: any[]) {
		// check if results from the different sources match
		const a = results[0];
		const srcA = this._sources[0].provider.connection.url;
		const objA = clean(cloneDeep(a));
		const strA = JSON.stringify(objA);

		results.slice(1).forEach((b, i) => {
			const srcB = this._sources[i + 1].provider.connection.url;
			const objB = clean(cloneDeep(b));
			const strB = JSON.stringify(objB);

			if (strA !== strB) {
				const diff = {
					[srcA]: objA,
					[srcB]: objB,
				};
				throw new Error(
					`Sources returned different results: ${JSON.stringify(diff)}`
				);
			}
		});

		return results[0];
	}
}
