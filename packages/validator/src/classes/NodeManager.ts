import {
	ERC20__factory,
	LogStoreNodeManager,
} from '@concertodao/logstore-contracts';
import { BigNumber } from '@ethersproject/bignumber';

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
		// const isSingleNode = headBrokerNodeAddress === tailBrokerNodeAddress;
		let currentBrokerNodeAddressInLoop = headBrokerNodeAddress;
		while (currentBrokerNodeAddressInLoop !== '') {
			// currentBrokerNodeAddressInLoop === '' when there's nothing left in brokerNode.next
			// TODO: fix this.
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

			// Hydrate the delegates
			const nodeStakeUpdateEvents = await this.contract.queryFilter(
				this.contract.filters.NodeStakeUpdated(),
				0,
				blockNumber
			);
			const delegates = {};
			for (let i = 0; i < nodeStakeUpdateEvents.length; i++) {
				const e = nodeStakeUpdateEvents[i];
				const receipt = await e.getTransactionReceipt();
				const { from } = receipt;
				const nodeAddress = e.args.nodeAddress.toString();
				const stake = e.args.stake.toNumber();
				if (!delegates[from]) {
					delegates[from] = [];
				}
				let isDelegate = false;
				if (stake > (delegates[from].stake || 0)) {
					isDelegate = true;
				}
				delegates[from].stake = stake;
				delegates[from].a = nodeAddress;
			}

			console.log('Broker Node Fetched!', {
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
