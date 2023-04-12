import { ethers } from 'ethers';

import { PoolConfigContracts } from '../types/index';
import { getClosestBlockByTime } from '../utils/helpers';
import { NodeManagerContract } from './NodeManager';
// import { QueryManagerContract } from './QueryManager';
import { ReportManagerContract } from './ReportManager';
import { StoreManagerContract } from './StoreManager';

export class Managers {
	private provider: ethers.Provider;

	public store: StoreManagerContract;
	// public query: QueryManagerContract;
	public node: NodeManagerContract;
	public report: ReportManagerContract;

	constructor(rpcUrl: string, addresses: PoolConfigContracts) {
		this.provider = new ethers.JsonRpcProvider(rpcUrl);

		this.store = new StoreManagerContract(
			this.provider,
			addresses.storeManager.address
		);
		this.report = new ReportManagerContract(
			this.provider,
			addresses.reportManager.address
		);
		this.node = new NodeManagerContract(
			this.provider,
			addresses.nodeManager.address
		);
		// this.queryManager = new NodeManagerContract(
		// 	this.provider,
		// 	addresses.queryManager.address
		// );
	}

	public async getBlockByTime(ts: number): Promise<ethers.Block> {
		const { provider } = this;
		let block = await getClosestBlockByTime(ts, provider);
		if (ts !== block.timestamp) {
			block = await provider.getBlock(block.number - 1);
		}
		return block;
	}
}
