import { BigNumber } from '@ethersproject/bignumber';
import type {
	ProveQueriesRequestBody,
	ProveQueriesResponse,
} from '@logsn/broker/src/plugins/logStore/http/proveQueriesEndpoint';
import { NodeMetadata } from '@logsn/client';
import { LogStoreNodeManager, LSAN__factory } from '@logsn/contracts';
import { StakeDelegateUpdatedEvent } from '@logsn/contracts/dist/src/NodeManager.sol/LogStoreNodeManager';
import axios from 'axios';
import { Base64 } from 'js-base64';

import type { IChainSource } from '../sources';
import { EventSelect, EventsIndexer } from '../threads';
import { IBrokerNode, IRuntimeExtended } from '../types';
import { Slogger } from '../utils/slogger';
import { StakeToken } from './StakeToken';

export class NodeManager {
	constructor(
		protected core: Pick<
			IRuntimeExtended,
			'events' | 'chain' | 'heartbeat' | 'logStoreClient' | 'signer' | 'logger'
		>
	) {}

	async getBrokerNodes(
		toBlockNumber: number,
		minStakeRequirement?: BigNumber
	): Promise<Array<IBrokerNode>> {
		// get all the node addresses
		const baseNodes = await this.core.chain.use(async (source) => {
			const contract = await source.contracts.node();
			const nodeAddresses = await contract.nodeAddresses({
				blockTag: toBlockNumber,
			});

			// get more details for each node's address
			const nodesData = await Promise.all(
				nodeAddresses.map(this.getNodeData(contract, toBlockNumber, source))
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

	private getNodeData(
		contract: LogStoreNodeManager,
		toBlockNumber: number,
		source: IChainSource
	) {
		return async (nodeAddress) => {
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
		};
	}

	async getBrokerEndpoint(): Promise<string> {
		const onlineBrokers = this.core.heartbeat.onlineBrokers;
		const randomBrokerAddress =
			onlineBrokers[Math.floor(Math.random() * onlineBrokers.length)];

		return await this.core.chain.use(async (source) => {
			const contract = await source.contracts.node();
			const node = await contract.nodes(randomBrokerAddress);
			const metadata = JSON.parse(node.metadata) as NodeMetadata;
			return metadata.http;
		});
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
		const events = await this.core.events.query(
			[EventSelect.StakeDelegateUpdated],
			toBlockNumber
		);
		const stakeDelegateUpdatedEvents: StakeDelegateUpdatedEvent[] = [];
		events.forEach((ev) => {
			ev.value.StakeDelegateUpdated.forEach((rawEvt) => {
				const evt = EventsIndexer.deserializeEvent(rawEvt);
				if (evt.args.node === nodeAddress) {
					stakeDelegateUpdatedEvents.push(evt);
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
		const tokenData = await this.core.chain.use(async (source) => {
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
			this.core.chain
		);

		return stakeToken;
	}

	private async getAuthorizationHeader() {
		const authUser = await this.core.logStoreClient.getAddress();
		const authPassword = await this.core.signer.signMessage(authUser);
		return `Basic ${Base64.encode(`${authUser}:${authPassword}`)}`;
	}

	public get callEndpoint() {
		return {
			proveQueries: async (args: ProveQueriesRequestBody) => {
				const endpoint = `${await this.getBrokerEndpoint()}/prove/queries`;

				this.core.logger.debug(
					'Calling recovery enpoint',
					JSON.stringify({
						endpoint,
						requestId,
						from,
						to,
					})
				);

				const headers = { Authorization: await this.getAuthorizationHeader() };

				return axios.post(endpoint, args, {
					headers,
				}) as Promise<ProveQueriesResponse>;
			},
		};
	}
}
