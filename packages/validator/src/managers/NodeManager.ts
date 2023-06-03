import {
	ERC20__factory,
	LogStoreNodeManager,
} from '@concertotech/logstore-contracts';
import { BigNumber } from '@ethersproject/bignumber';

import { IBrokerNode } from '../types';
import { StakeToken } from '../utils/stake-token';

export class NodeManager {
	constructor(private _contract: LogStoreNodeManager) {}

	public get contract() {
		return this._contract;
	}

	async getBrokerNodes(
		blockNumber?: number,
		minStakeRequirement?: number
	): Promise<Array<IBrokerNode>> {
		// get all the node addresses
		const nodeAddresses = await this.contract.nodeAddresses({
			blockTag: blockNumber,
		});

		// get more details for each node's address
		const detailedAllNodes = await Promise.all(
			nodeAddresses.map(async (nodeAddress) => {
				const nodeDetail = await this.contract.nodes(nodeAddress, {
					blockTag: blockNumber,
				});
				const allDelegates = await this.getDelegates(nodeAddress, blockNumber);

				console.log('DEBUG: Delegates for Node Address', {
					allDelegates,
					nodeAddress,
				});

				return {
					id: nodeAddress,
					index: nodeDetail.index.toNumber(),
					metadata: nodeDetail.metadata,
					lastSeen: nodeDetail.lastSeen.toNumber(),
					next: nodeDetail.next,
					prev: nodeDetail.prev,
					stake: +nodeDetail.stake,
					delegates: allDelegates,
				};
			})
		);

		// Filter out all nodes fetched which have a stake > minstake
		const brokerNodes = detailedAllNodes.filter(
			({ stake }) =>
				typeof minStakeRequirement !== 'undefined' &&
				stake > minStakeRequirement
		);

		return brokerNodes;
	}

	/**
	 * Get all delegates and their corresponding amounts for a nodeAddress at a blockNumber
	 *
	 * @param   {string}  nodeAddress    [nodeAddress description]
	 * @param   {number}  toBlockNumber  [toBlockNumber description]
	 */
	async getDelegates(
		nodeAddress: string,
		toBlockNumber: number
	): Promise<Record<string, number>> {
		const delegatesEvent = await this.contract.queryFilter(
			this.contract.filters.StakeDelegateUpdated(
				null,
				nodeAddress,
				null,
				null,
				null,
				null
			),
			0,
			toBlockNumber
		);

		const eventDetails = delegatesEvent.map(({ args }) => ({
			delegate: args.delegate,
			amount:
				args.delegated === true ? Number(args.amount) : -Number(args.amount),
		}));

		return eventDetails.reduce((accumulator, curr) => {
			if (accumulator[curr.delegate] === undefined) {
				accumulator[curr.delegate] = 0;
			} else {
				accumulator[curr.delegate] += curr.amount;
			}
			return accumulator;
		}, {});
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
		const stakeToken = new StakeToken(
			stakeTokenAddress,
			stakeTokenSymbol,
			stakeTokenDecimals,
			+minStakeRequirement,
			this.contract.signer
		);

		await stakeToken.init();

		return stakeToken;
	}

	async getStartBlockNumber(): Promise<number> {
		const startBlockNumber = await this.contract.startBlockNumber();
		return startBlockNumber.toNumber();
	}
}
