import { abi as NodeManagerContractABI } from '@concertodao/logstore-contracts/artifacts/src/NodeManager.sol/LogStoreNodeManager.json';
import { ethers } from 'ethers';

import erc20ABI from '../abi/erc20';
import { BrokerNode } from '../types';
import { parseStruct } from '../utils/helpers';

type StakeToken = {
	minRequirement: number;
	address: string;
	symbol: string;
	decimals: number;
};

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

	async getBrokerNodes(blockNumber?: number, minStakeRequirement?: number) {
		const brokerNodes: BrokerNode[] = [];
		const headBrokerNodeAddress: string = await this.contract.headNode({
			blockNumber,
		});
		const tailBrokerNodeAddress: string = await this.contract.tailNode({
			blockNumber,
		});
		console.log('Broker Node Head/Tail', {
			head: headBrokerNodeAddress,
			tail: tailBrokerNodeAddress,
		});
		// const isSingleNode = headBrokerNodeAddress === tailBrokerNodeAddress;
		let currentBrokerNodeAddressInLoop = headBrokerNodeAddress;
		while (currentBrokerNodeAddressInLoop !== '') {
			// currentBrokerNodeAddressInLoop === '' when there's nothing left in brokerNode.next
			const brokerNodeStruct = await this.contract.nodes(
				currentBrokerNodeAddressInLoop
			);
			const brokerNode = parseStruct(brokerNodeStruct) as BrokerNode; // TODO: This doesn't work.
			/**
			 *  Broker Node Fetched! {
      brokerNodeStruct: Result(6) [
        0n,
        '{ "hello": "world" }',
        1680870273n,
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        999999999999999983222784n
      ],
      brokerNode: {}
    }
			 */
			console.log('Broker Node Fetched!', {
				brokerNodeStruct,
				brokerNode,
			});
			if (
				typeof minStakeRequirement === 'undefined' ||
				brokerNode.stake >= minStakeRequirement
			) {
				brokerNodes.push({
					id: currentBrokerNodeAddressInLoop,
					...brokerNode,
				});
			}
			currentBrokerNodeAddressInLoop = brokerNode.next;
		}

		return brokerNodes;
	}

	async getStakeToken(blockNumber?: number): Promise<StakeToken> {
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
