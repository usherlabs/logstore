import { JsonRpcProvider, Provider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import { sha256 } from '@kyvejs/protocol';
import {
	getNodeManagerContract,
	getReportManagerContract,
	getStoreManagerContract,
} from '@logsn/shared';
import { cloneDeep } from 'lodash';

import { getEvmPrivateKey } from '../env-config';
import { NodeManager } from './NodeManager';
import { ReportManager } from './ReportManager';
import { StoreManager } from './StoreManager';

export class Managers {
	private _provider: Provider;

	public store: StoreManager;
	public node: NodeManager;
	public report: ReportManager;

	constructor(rpcUrl: string) {
		this._provider = new JsonRpcProvider(rpcUrl);
	}

	public get provider() {
		return this._provider;
	}

	async init() {
		const priv = getEvmPrivateKey();
		const wallet = new Wallet(priv, this.provider);
		const cStore = await getStoreManagerContract(wallet);
		const cReport = await getReportManagerContract(wallet);
		const cNode = await getNodeManagerContract(wallet);

		this.node = new NodeManager(cNode);
		this.store = new StoreManager(cStore);
		this.report = new ReportManager(cReport);
	}

	public async getBlock(blockNumber: number) {
		const { provider } = this;
		const block = await provider.getBlock(blockNumber);
		return block;
	}

	private static sources: string[];
	private static sourcesHash: string;
	private static managers: { source: string; managers: Managers }[];

	public static async setSources(sources: string[]) {
		const sourcesHash = sha256(Buffer.from(JSON.stringify(sources)));

		if (this.sourcesHash != sourcesHash) {
			this.managers = await Promise.all(
				sources.map(async (source) => {
					const managers = new Managers(source);
					await managers.init();
					return {
						source,
						managers,
					};
				})
			);

			this.sources = sources;
			this.sourcesHash = sourcesHash;
		}
	}

	/**
	 * This method encapsulate the iteration over sources and consolidation of result for each Blockchain RPC source.
	 */
	public static async withSources<T>(
		fn: (managers: Managers, source: string) => Promise<T>
	): Promise<T> {
		const results = await Promise.all(
			this.managers.map(async ({ source, managers }) => {
				return await fn(managers, source);
			})
		);

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

		// check if results from the different sources match
		const a = results[0];
		const srcA = this.sources[0];
		const objA = clean(cloneDeep(a));
		const strA = JSON.stringify(objA);

		results.slice(1).forEach((b, i) => {
			const srcB = this.sources[i + 1];
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
