import { getEvmPrivateKey } from '../env-config';
import {
	getNodeManagerContract,
	getReportManagerContract,
	getStoreManagerContract,
} from '@concertodao/logstore-shared';
import { JsonRpcProvider, Provider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';

import { getClosestBlockByTime } from '../utils/helpers';
import { NodeManager } from './NodeManager';
import { ReportManager } from './ReportManager';
import { StoreManager } from './StoreManager';

export class Managers {
	private provider: Provider;

	public store: StoreManager;
	public node: NodeManager;
	public report: ReportManager;

	constructor(rpcUrl: string) {
		this.provider = new JsonRpcProvider(rpcUrl);
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

	public async getBlockByTime(ts: number) {
		const { provider } = this;
		let block = await getClosestBlockByTime(ts, provider);
		if (ts !== block.timestamp) {
			block = await provider.getBlock(block.number - 1);
		}
		return block;
	}
}
