import {
	ERC20__factory,
	LogStoreNodeManager,
} from '@concertodao/logstore-contracts';
import { BigNumber } from '@ethersproject/bignumber';
import { ethers } from 'ethers';

import { BrokerNode } from '../types';

type StakeToken = {
	minRequirement: number;
	address: string;
	symbol: string;
	decimals: number;
};

export class NodeManager {
	constructor(private _contract: LogStoreNodeManager) {}

	public get contract() {
		return this._contract;
	}

	async getBrokerNodes(blockNumber?: number, minStakeRequirement?: number) {
		const brokerNodes: BrokerNode[] = [];
		const headBrokerNodeAddress: string = await this.contract.headNode({
			blockTag: blockNumber,
		});
		const tailBrokerNodeAddress: string = await this.contract.tailNode({
			blockTag: blockNumber,
		});
		console.log('Broker Node Head/Tail', {
			head: headBrokerNodeAddress,
			tail: tailBrokerNodeAddress,
		});
		const nodeStakeUpdateEvents = await this.contract.queryFilter(
			this.contract.filters.NodeStakeUpdated(),
			0,
			blockNumber
		);

		// const isSingleNode = headBrokerNodeAddress === tailBrokerNodeAddress;
		let currentBrokerNodeAddressInLoop = headBrokerNodeAddress;
		while (
			currentBrokerNodeAddressInLoop !== '' &&
			currentBrokerNodeAddressInLoop !== ethers.ZeroAddress
		) {
			// currentBrokerNodeAddressInLoop === '' when there's nothing left in brokerNode.next
			const brokerNodeStruct = await this.contract.nodes(
				currentBrokerNodeAddressInLoop,
				{ blockTag: blockNumber }
			);
			let brokerNode: BrokerNode = {
				id: currentBrokerNodeAddressInLoop,
				index: brokerNodeStruct.index.toNumber(),
				metadata: brokerNodeStruct.metadata,
				lastSeen: brokerNodeStruct.lastSeen.toNumber(),
				next: brokerNodeStruct.next,
				prev: brokerNodeStruct.prev,
				stake: brokerNodeStruct.stake.toNumber(),
				delegates: [],
			};
			if (
				typeof minStakeRequirement === 'undefined' ||
				brokerNode.stake < minStakeRequirement
			) {
				currentBrokerNodeAddressInLoop = brokerNode.next;
				continue;
			}

			// Hydrate the delegates

			// ! Below is incorrect because captures managed by reports could yield outcomes where the undelegate amount is less than the original delegate amount.
			// TODO: https://ethereum.stackexchange.com/questions/34555/how-to-get-value-of-input-parameters-from-transaction-history -- use to determine amount in block transaction parameters.
			// let stake = 0;
			// const delegates = {}
			// for (let i = 0; i < nodeStakeUpdateEvents.length; i++) {
			// 	const e = nodeStakeUpdateEvents[i];
			// 	const receipt = await e.getTransactionReceipt();
			// 	const { from } = receipt;
			// 	const newStake = e.args.stake.toNumber();
			// 	const diff = newStake - stake;
			// 	if(!delegates[from]){
			// 		delegates[from] = 0;
			// 	}
			// 	delegates[from] += diff;
			// 	stake = newStake;
			// }

			// const nodeUpdates = nodeStakeUpdateEvents.filter(
			// 	(e) => e.args.nodeAddress.toString() === brokerNode.id
			// );
			// const events = await Promise.all(nodeUpdates.map(async e => {
			// 	const res = {
			// 		...e,
			// 		receipt: await e.getTransactionReceipt()
			// 	}
			// 	return res;
			// }))
			// events.sort((a, b) => {
			// 	return a.receipt.blockNumber > b.receipt.blockNumber ? 1 : -1;
			// })

			// // Hydrate the delegates
			// let stake = 0;
			// const delegatesOf = {}
			// for (let i = 0; i < events.length; i++) {
			// 	const e = events[i];
			// 	const { from } = e.receipt;
			// 	const eventStake = e.args.stake.toNumber();
			// 	const diff = eventStake - stake
			// 	if(!delegates[from]){
			// 		delegates[from] = 0;
			// 	}
			// 	delegates[from] += diff;
			// }

			console.log('Broker Node Fetched!', {
				brokerNode,
			});
			currentBrokerNodeAddressInLoop = brokerNode.next;
		}

		return brokerNodes;
	}

	async getStakeToken(blockNumber?: number): Promise<StakeToken> {
		const minStakeRequirement: BigNumber =
			await this.contract.stakeRequiredAmount({ blockTag: blockNumber });
		const stakeTokenAddress: string = await this.contract.stakeTokenAddress({
			blockTag: blockNumber,
		});
		// Get decimal count for the stake token
		const stakeTokenContract = ERC20__factory.connect(
			stakeTokenAddress,
			this.contract.provider
		);
		const stakeTokenSymbol = await stakeTokenContract.symbol();
		const stakeTokenDecimals = await stakeTokenContract.decimals();

		return {
			minRequirement: minStakeRequirement.toNumber(),
			address: stakeTokenAddress,
			symbol: stakeTokenSymbol,
			decimals: stakeTokenDecimals,
		};
	}
}
