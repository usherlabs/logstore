import { abi as NodeManagerContractABI } from '@concertodao/logstore-contracts/artifacts/src/NodeManager.sol/LogStoreNodeManager.json';
import { ethers } from 'ethers';

import erc20ABI from '../abi/erc20';
import { BrokerNode } from '../types';

export class NodeManagerContract {
	private _contract: ethers.Contract;

	constructor(private provider: ethers.Provider, address: string) {
		this._contract = new ethers.Contract(address, NodeManagerContractABI, {
			provider,
		});
	}

	public get contract() {
		return this._contract;
	}

	async getBrokerNodes(blockNumber?: number) {
		const brokerNodes: BrokerNode[] = [];
		const headBrokerNodeAddress: string = await this.contract.headNode({
			blockNumber,
		});
		const tailBrokerNodeAddress: string = await this.contract.tailNode({
			blockNumber,
		});
		let currentBrokerNodeAddressInLoop = headBrokerNodeAddress;
		while (currentBrokerNodeAddressInLoop !== tailBrokerNodeAddress) {
			const brokerNode: BrokerNode = await this.contract.nodes(
				currentBrokerNodeAddressInLoop
			);
			brokerNodes.push({
				id: currentBrokerNodeAddressInLoop,
				...brokerNode,
			});
			currentBrokerNodeAddressInLoop = brokerNode.next;
		}

		return brokerNodes;
	}

	async getStakeToken(blockNumber?: number) {
		const minStakeRequirement: number = await this.contract.stakeRequiredAmount(
			{ blockNumber }
		);
		const stakeTokenAddress: string = await this.contract.stakeTokenAddress({
			blockNumber,
		});
		// Get decimal count for the stake token
		const stakeTokenContract = new ethers.Contract(
			stakeTokenAddress,
			erc20ABI,
			{
				provider: this.provider,
			}
		);
		const stakeTokenSymbol = await stakeTokenContract.symbol();
		const stakeTokenDecimals = await stakeTokenContract.decimals();

		return {
			minRequirement: minStakeRequirement,
			address: stakeTokenAddress,
			symbol: stakeTokenSymbol,
			decimals: stakeTokenDecimals,
		};
	}
}
