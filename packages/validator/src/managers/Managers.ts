import { JsonRpcProvider, Provider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import {
	getNodeManagerContract,
	getReportManagerContract,
	getStoreManagerContract,
} from '@logsn/shared';

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

		// this.store = new StoreManager(this.provider, );
		this.node = new NodeManager(cNode);
		this.store = new StoreManager(cStore);
		this.report = new ReportManager(cReport);
	}

	public async getBlock(blockNumber: number) {
		const { provider } = this;
		const block = await provider.getBlock(blockNumber);
		return block;
	}

	/**
	 * This method encapsulate the iteration over sources and consolidation of result for each Blockchain RPC source.
	 */
	public static async withSources<T>(
		sources: string[],
		// eslint-disable-next-line
		fn: (managers: Managers, source: string) => Promise<T>
	): Promise<T> {
		const results = [];
		for (const source of sources) {
			const managers = new Managers(source);
			await managers.init();

			const result = await fn(managers, source);
			results.push(result);
		}

		// check if results from the different sources match
		if (
			!results.every((b) => JSON.stringify(b) === JSON.stringify(results[0]))
		) {
			throw new Error(`Sources returned different results`);
		}

		return results[0];
	}
}
