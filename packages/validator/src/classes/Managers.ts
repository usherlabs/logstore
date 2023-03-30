import { ethers } from 'ethers';

import { PoolConfigContracts } from '../types/index';
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

	public async getBlockByTime(ts: number): Promise<number> {
		// ? toKey will be a recent timestamp as the Pool's start_key will be the timestamp the Pool was created.
		let blockNumber = await this.provider.getBlockNumber();
		let blockNumberTimestamp = 0;
		do {
			const block = await this.provider.getBlock(blockNumber);
			blockNumberTimestamp = block.timestamp;
			blockNumber--;
		} while (blockNumberTimestamp > ts);
		blockNumber++; // re-add the removed latest block

		return blockNumber;
	}
}
