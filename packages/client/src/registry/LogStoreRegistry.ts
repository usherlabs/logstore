import { BigNumber } from '@ethersproject/bignumber';
import type { Overrides } from '@ethersproject/contracts';
import { Provider } from '@ethersproject/providers';
import type { LogStoreManager as LogStoreManagerContract } from '@logsn/contracts';
import { abi as LogStoreManagerAbi } from '@logsn/contracts/artifacts/src/StoreManager.sol/LogStoreManager.json';
import { prepareStakeForStoreManager } from '@logsn/shared';
import {
	Authentication,
	AuthenticationInjectionToken,
	collect,
	ContractFactory,
	LoggerFactory,
	queryAllReadonlyContracts,
	Stream,
	StreamIDBuilder,
} from '@logsn/streamr-client';
import { toStreamID } from '@streamr/protocol';
import { Logger, toEthereumAddress } from '@streamr/utils';
import { ContractTransaction } from 'ethers';
import { min } from 'lodash';
import { delay, inject, Lifecycle, scoped } from 'tsyringe';

import {
	LogStoreClientConfigInjectionToken,
	StrictLogStoreClientConfig,
} from '../Config';
import {
	getStreamRegistryChainProviders,
	getStreamRegistryOverrides,
} from '../Ethereum';
import {
	initEventGateway,
	LogStoreClientEventEmitter,
	LogStoreClientEvents,
} from '../events';
import { LogStoreClient } from '../LogStoreClient';
import {
	StreamrClientConfigInjectionToken,
	StrictStreamrClientConfig,
} from '../streamr/Config';
import { SynchronizedGraphQLClient } from '../utils/SynchronizedGraphQLClient';

export interface LogStoreAssignmentEvent {
	readonly store: string;
	readonly isNew: boolean;
	readonly amount: BigNumber;
	readonly blockNumber: number;
}

/**
 * Stores storage node assignments (mapping of streamIds <-> storage nodes addresses)
 */
@scoped(Lifecycle.ContainerScoped)
export class LogStoreRegistry {
	private contractFactory: ContractFactory;
	private logStoreClient: LogStoreClient;
	private streamIdBuilder: StreamIDBuilder;
	private graphQLClient: SynchronizedGraphQLClient;
	private readonly eventEmitter: LogStoreClientEventEmitter;
	private authentication: Authentication;
	private logStoreClientConfig: Pick<StrictLogStoreClientConfig, 'contracts'>;
	private streamrClientConfig: Pick<StrictStreamrClientConfig, 'contracts'>;
	private logStoreManagerContract?: LogStoreManagerContract;
	private readonly logStoreManagerContractsReadonly: LogStoreManagerContract[];
	private readonly logger: Logger;

	constructor(
		@inject(ContractFactory)
		contractFactory: ContractFactory,
		@inject(delay(() => LogStoreClient))
		logStoreClient: LogStoreClient,
		@inject(StreamIDBuilder)
		streamIdBuilder: StreamIDBuilder,
		@inject(SynchronizedGraphQLClient)
		graphQLClient: SynchronizedGraphQLClient,
		@inject(LogStoreClientEventEmitter)
		eventEmitter: LogStoreClientEventEmitter,
		@inject(AuthenticationInjectionToken)
		authentication: Authentication,
		@inject(LoggerFactory)
		loggerFactory: LoggerFactory,
		@inject(LogStoreClientConfigInjectionToken)
		logStoreClientConfig: Pick<StrictLogStoreClientConfig, 'contracts'>,
		@inject(StreamrClientConfigInjectionToken)
		streamrClientConfig: Pick<StrictStreamrClientConfig, 'contracts'>
	) {
		this.contractFactory = contractFactory;
		this.logStoreClient = logStoreClient;
		this.streamIdBuilder = streamIdBuilder;
		this.graphQLClient = graphQLClient;
		this.eventEmitter = eventEmitter;
		this.authentication = authentication;
		this.logStoreClientConfig = logStoreClientConfig;
		this.streamrClientConfig = streamrClientConfig;
		this.logger = loggerFactory.createLogger(module);
		this.logStoreManagerContractsReadonly = getStreamRegistryChainProviders(
			this.streamrClientConfig
		).map((provider: Provider) => {
			return this.contractFactory.createReadContract(
				toEthereumAddress(
					this.logStoreClientConfig.contracts.logStoreStoreManagerChainAddress
				),
				LogStoreManagerAbi,
				provider,
				'logStoreManager'
			) as LogStoreManagerContract;
		});
		this.initStreamAssignmentEventListener(
			'addToLogStore',
			'StoreUpdated',
			eventEmitter
		);
	}

	// TODO: Log Store doesn't actually add Streams to storage directly via the Client...
	private initStreamAssignmentEventListener(
		clientEvent: keyof LogStoreClientEvents,
		contractEvent: string,
		eventEmitter: LogStoreClientEventEmitter
	) {
		const primaryReadonlyContract = this.logStoreManagerContractsReadonly[0];
		type Listener = (
			store: string,
			isNew: boolean,
			amount: BigNumber,
			address: string,
			extra: any
		) => void;
		// type Listener = (streamId: string, nodeAddress: string, extra: any) => void;
		this.logger.debug('initStreamAssignmentEventListener');
		initEventGateway(
			clientEvent,
			(emit: (payload: LogStoreAssignmentEvent) => void) => {
				const listener = (
					store: string,
					isNew: boolean,
					amount: BigNumber,
					extra: any
				) => {
					this.logger.debug(
						'Emitting event %s stream %s',
						contractEvent,
						store
					);
					emit({
						store,
						isNew,
						amount,
						// nodeAddress: toEthereumAddress(nodeAddress),
						blockNumber: extra.blockNumber,
					});
				};
				primaryReadonlyContract.on(contractEvent, listener);
				return listener;
			},
			(listener: Listener) => {
				primaryReadonlyContract.off(contractEvent, listener);
			},
			eventEmitter
		);
	}

	private async connectToContract() {
		if (!this.logStoreManagerContract) {
			const chainSigner =
				await this.authentication.getStreamRegistryChainSigner();
			this.logStoreManagerContract =
				this.contractFactory.createWriteContract<LogStoreManagerContract>(
					toEthereumAddress(
						this.logStoreClientConfig.contracts.logStoreStoreManagerChainAddress
					),
					LogStoreManagerAbi,
					chainSigner,
					'logStoreManager'
				);
		}
	}

	// --------------------------------------------------------------------------------------------
	// Log Store
	// --------------------------------------------------------------------------------------------

	async stakeOrCreateStore(
		streamIdOrPath: string,
		amount: bigint,
		overrides?: Overrides
	): Promise<ContractTransaction> {
		const streamId = await this.streamIdBuilder.toStreamID(streamIdOrPath);
		this.logger.debug('adding stream %s to LogStore', streamId);
		await this.connectToContract();
		this.logger.debug('approving LogStore contract for token funds', streamId);
		// @dev 'chainSigner' could either be a wallet or a signer
		// @dev depending on if a pk was passed into the contract
		const chainSigner =
			await this.authentication.getStreamRegistryChainSigner();
		await prepareStakeForStoreManager(chainSigner, amount, false);
		const ethersOverrides = getStreamRegistryOverrides(
			this.streamrClientConfig
		);
		return this.logStoreManagerContract!.stake(streamId, amount, {
			...ethersOverrides,
			...overrides,
		});
	}

	async getStreamBalance(streamIdOrPath: string): Promise<bigint> {
		const streamId = await this.streamIdBuilder.toStreamID(streamIdOrPath);
		// `stores` maps the streamId to the storage balance
		return await queryAllReadonlyContracts(async (contract) => {
			const storeBalanceBN = await contract.stores(streamId);
			return storeBalanceBN.toBigInt();
		}, this.logStoreManagerContractsReadonly);
	}

	async getStoreBalanceOf(address: string): Promise<bigint> {
		return await queryAllReadonlyContracts(async (contract) => {
			const storeBalanceBN = await contract.balanceOf(address);
			return storeBalanceBN.toBigInt();
		}, this.logStoreManagerContractsReadonly);
	}

	async getStoreBalance(): Promise<bigint> {
		const signer = await this.authentication.getStreamRegistryChainSigner();
		const address = await signer.getAddress();
		return await this.getStoreBalanceOf(address);
	}

	async isLogStoreStream(streamIdOrPath: string): Promise<boolean> {
		const streamId = await this.streamIdBuilder.toStreamID(streamIdOrPath);
		this.logger.debug('querying if stream %s is in LogStore', streamId);
		return queryAllReadonlyContracts((contract: LogStoreManagerContract) => {
			return contract.exists(streamId);
		}, this.logStoreManagerContractsReadonly);
	}

	async getStoredStreams(): Promise<{
		streams: Stream[];
		blockNumber: number;
	}> {
		this.logger.debug('getting stored streams');
		const blockNumbers: number[] = [];
		// await collect(
		const res = await collect(
			this.graphQLClient.fetchPaginatedResults(
				(lastId: string, pageSize: number) => {
					const query = `
					{
						storeUpdateds(first: ${pageSize}, orderBy: store where: {store_gt: "${lastId}"}) {
							store
						}
						_meta {
							block {
								number
							}
						}
					}`;
					return { query };
				},
				(response: any) => {
					// eslint-disable-next-line no-underscore-dangle
					blockNumbers.push(response._meta.block.number);
					return response.storeUpdateds;
					// return response.node !== null ? response.node.storedStreams : [];
				}
			)
		);
		this.logger.debug('res: %s', res);
		const streams = (
			await Promise.all(
				res.map(async (storeUpdated: any) => {
					try {
						return await this.logStoreClient.getStream(
							toStreamID(storeUpdated.store)
						);
					} catch (err) {
						this.logger.error(err);
						return null;
					}
				})
			)
		).filter((stream) => stream != null) as Stream[];

		this.logger.debug(
			'streams: %s',
			JSON.stringify(
				streams.map((stream) => stream.id.toString()),
				null,
				2
			)
		);

		return {
			streams,
			blockNumber: min(blockNumbers)!,
		};
	}

	// --------------------------------------------------------------------------------------------
	// Events
	// --------------------------------------------------------------------------------------------

	/**
	 * Adds an event listener to the client.
	 * @param eventName - event name, see {@link LogStoreClientEvents} for options
	 * @param listener - the callback function
	 */
	on<T extends keyof LogStoreClientEvents>(
		eventName: T,
		listener: LogStoreClientEvents[T]
	): void {
		this.eventEmitter.on(eventName, listener as any);
	}

	/**
	 * Adds an event listener to the client that is invoked only once.
	 * @param eventName - event name, see {@link LogStoreClientEvents} for options
	 * @param listener - the callback function
	 */
	once<T extends keyof LogStoreClientEvents>(
		eventName: T,
		listener: LogStoreClientEvents[T]
	): void {
		this.eventEmitter.once(eventName, listener as any);
	}

	/**
	 * Removes an event listener from the client.
	 * @param eventName - event name, see {@link LogStoreClientEvents} for options
	 * @param listener - the callback function to remove
	 */
	off<T extends keyof LogStoreClientEvents>(
		eventName: T,
		listener: LogStoreClientEvents[T]
	): void {
		this.eventEmitter.off(eventName, listener as any);
	}
}
