import { BigNumber } from '@ethersproject/bignumber';
import { LogStoreNodeManager, LSAN__factory } from '@logsn/contracts';

import { overrideStartBlockNumber } from '../env-config';
import { IBrokerNode } from '../types';
import { Slogger } from '../utils/slogger';
import { StakeToken } from '../utils/stake-token';

export class NodeManager {
	private readonly fromBlockNumber: Record<string, number> = {};
	private readonly delegates: Record<string, Record<string, BigNumber>> = {};

	constructor(private _contract: LogStoreNodeManager) {}

	public get contract() {
		return this._contract;
	}

	async getBrokerNodes(
		fromBlockNumber: number,
		toBlockNumber: number,
		minStakeRequirement?: BigNumber
	): Promise<Array<IBrokerNode>> {
		// get all the node addresses
		const nodeAddresses = await this.contract.nodeAddresses({
			blockTag: toBlockNumber,
		});

		// get more details for each node's address
		const detailedAllNodes = await Promise.all(
			nodeAddresses.map(async (nodeAddress) => {
				const nodeDetail = await this.contract.nodes(nodeAddress, {
					blockTag: toBlockNumber,
				});
				const allDelegates = await this.getDelegates(
					nodeAddress,
					fromBlockNumber,
					toBlockNumber
				);

				Slogger.instance.debug('Delegates for Node Address', {
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
					stake: nodeDetail.stake,
					delegates: allDelegates,
				};
			})
		);

		// Filter out all nodes fetched which have a stake > minstake
		const brokerNodes = detailedAllNodes.filter(
			({ stake }) =>
				typeof minStakeRequirement !== 'undefined' &&
				stake.gte(minStakeRequirement)
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
		fromBlockNumber: number,
		toBlockNumber: number
	): Promise<Record<string, BigNumber>> {
		if (
			this.fromBlockNumber[nodeAddress] == undefined ||
			this.fromBlockNumber[nodeAddress] < fromBlockNumber
		) {
			this.fromBlockNumber[nodeAddress] = fromBlockNumber;
		}

		// If the range already cached return the cached data
		if (this.fromBlockNumber[nodeAddress] > toBlockNumber) {
			return this.delegates[nodeAddress];
		}

		const delegatesEvent = await this.contract.queryFilter(
			this.contract.filters.StakeDelegateUpdated(
				null,
				nodeAddress,
				null,
				null,
				null,
				null
			),
			this.fromBlockNumber[nodeAddress],
			toBlockNumber
		);

		if (this.delegates[nodeAddress] == undefined) {
			this.delegates[nodeAddress] = {};
		}

		const delegates = this.delegates[nodeAddress];

		delegatesEvent.forEach(({ args }) => {
			const { delegate } = args;
			const amount =
				args.delegated === true ? args.amount : args.amount.mul(-1);

			if (delegates[delegate] === undefined) {
				delegates[delegate] = BigNumber.from(0);
			} else {
				delegates[delegate].add(amount);
			}
		});

		// Next time call for a range starting
		// from the block following the current toBlockNumber
		this.fromBlockNumber[nodeAddress] = toBlockNumber + 1;

		return delegates;
	}

	async getStakeToken(blockNumber?: number): Promise<StakeToken> {
		const minStakeRequirement: BigNumber =
			await this.contract.stakeRequiredAmount({ blockTag: blockNumber });
		const stakeTokenAddress: string = await this.contract.stakeTokenAddress({
			blockTag: blockNumber,
		});
		// Get decimal count for the stake token
		const stakeTokenContract = LSAN__factory.connect(
			stakeTokenAddress,
			this.contract.provider
		);
		const stakeTokenSymbol = await stakeTokenContract.symbol();
		const stakeTokenDecimals = await stakeTokenContract.decimals();
		const stakeToken = new StakeToken(
			stakeTokenAddress,
			stakeTokenSymbol,
			stakeTokenDecimals,
			minStakeRequirement,
			this.contract.signer
		);

		await stakeToken.init();

		return stakeToken;
	}

	// ? For testing purposes, enable overriding startBlockNumber
	async getStartBlockNumber(): Promise<number> {
		const startBlockNumber =
			overrideStartBlockNumber !== '0'
				? BigNumber.from(overrideStartBlockNumber)
				: await this.contract.startBlockNumber();
		const n = startBlockNumber.toNumber();
		if (n === 0) {
			throw new Error(
				'No Brokers Nodes are available on the network to validate'
			);
		}
		return n;
	}
}
