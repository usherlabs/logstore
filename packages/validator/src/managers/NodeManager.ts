import { BigNumber } from '@ethersproject/bignumber';
import { LSAN__factory } from '@logsn/contracts';
import { StakeDelegateUpdatedEvent } from '@logsn/contracts/dist/src/NodeManager.sol/LogStoreNodeManager';

import { overrideStartBlockNumber } from '../env-config';
import type { ChainSources } from '../sources';
import type { EventsIndexer } from '../threads';
import { EventSelect } from '../threads';
import { IBrokerNode } from '../types';
import { Slogger } from '../utils/slogger';
import { StakeToken } from './StakeToken';

export class NodeManager {
	constructor(
		protected chain: ChainSources,
		protected indexer: EventsIndexer
	) {}

	async getBrokerNodes(
		toBlockNumber: number,
		minStakeRequirement?: BigNumber
	): Promise<Array<IBrokerNode>> {
		// get all the node addresses
		const baseNodes = await this.chain.use(async (source) => {
			const contract = await source.contracts.node();
			const nodeAddresses = await contract.nodeAddresses({
				blockTag: toBlockNumber,
			});

			// get more details for each node's address
			const nodesData = await Promise.all(
				nodeAddresses.map(async (nodeAddress) => {
					const nodeDetail = await contract.nodes(nodeAddress, {
						blockTag: toBlockNumber,
					});

					Slogger.instance.debug(
						`Delegates for Node Address from source ${source.provider.connection.url}`,
						{
							nodeAddress,
						}
					);

					return {
						id: nodeAddress,
						index: nodeDetail.index.toNumber(),
						metadata: nodeDetail.metadata,
						lastSeen: nodeDetail.lastSeen.toNumber(),
						next: nodeDetail.next,
						prev: nodeDetail.prev,
						stake: nodeDetail.stake,
					};
				})
			);

			// Filter out all nodes fetched which have a stake > minstake
			const filteredNodes = nodesData.filter(
				({ stake }) =>
					typeof minStakeRequirement !== 'undefined' &&
					stake.gte(minStakeRequirement)
			);

			return filteredNodes;
		});

		// Now add delegates to the response.
		const final = await Promise.all(
			baseNodes.map(async (n) => ({
				...n,
				delegates: await this.getDelegatesForNode(n.id, toBlockNumber),
			}))
		);

		return final;
	}

	/**
	 * Get all delegates and their corresponding amounts for a nodeAddress at a blockNumber
	 *
	 * @param   {string}  nodeAddress    [nodeAddress description]
	 * @param   {number}  toBlockNumber  [toBlockNumber description]
	 */
	async getDelegatesForNode(
		nodeAddress: string,
		toBlockNumber: number
	): Promise<Record<string, BigNumber>> {
		const events = await this.indexer.query(
			[EventSelect.StakeDelegateUpdated],
			toBlockNumber
		);
		const stakeDelegateUpdatedEvents: StakeDelegateUpdatedEvent[] = [];
		events.forEach((ev) => {
			ev.value.StakeDelegateUpdated.forEach((stuEv) => {
				if (stuEv.args.node === nodeAddress) {
					stakeDelegateUpdatedEvents.push(stuEv);
				}
			});
		});

		const delegates: Record<string, BigNumber> = {};
		stakeDelegateUpdatedEvents.forEach(({ args }) => {
			const { delegate } = args;
			const amount =
				args.delegated === true ? args.amount : args.amount.mul(-1);

			if (delegates[delegate] === undefined) {
				delegates[delegate] = BigNumber.from(0);
			} else {
				delegates[delegate].add(amount);
			}
		});

		return delegates;
	}

	async getStakeToken(blockNumber?: number) {
		const tokenData = await this.chain.use(async (source) => {
			const contract = await source.contracts.node();
			const minStakeRequirement: BigNumber = await contract.stakeRequiredAmount(
				{ blockTag: blockNumber }
			);
			const address: string = await contract.stakeTokenAddress({
				blockTag: blockNumber,
			});

			// Get decimal count for the stake token
			const stakeTokenContract = LSAN__factory.connect(
				address,
				source.provider
			);
			const symbol = await stakeTokenContract.symbol();
			const decimals = await stakeTokenContract.decimals();

			return {
				minStakeRequirement,
				address,
				symbol,
				decimals,
			};
		});

		const stakeToken = new StakeToken(
			tokenData.address,
			tokenData.symbol,
			tokenData.decimals,
			tokenData.minStakeRequirement,
			this.chain
		);

		return stakeToken;
	}

	// ? For testing purposes, enable overriding startBlockNumber
	async getStartBlockNumber(): Promise<number> {
		let startBlockNumber;
		if (overrideStartBlockNumber !== '0') {
			BigNumber.from(overrideStartBlockNumber);
		} else {
			startBlockNumber = await this.chain.use(async (source) => {
				const contract = await source.contracts.node();
				return await contract.startBlockNumber();
			});
		}
		const n = startBlockNumber.toNumber();
		if (n === 0) {
			throw new Error(
				'No Brokers Nodes are available on the network to validate'
			);
		}
		return n;
	}
}
