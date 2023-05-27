import type { LogStoreManager as LogStoreManagerContract } from '@concertodao/logstore-contracts';
import { abi as LogStoreManagerAbi } from '@concertodao/logstore-contracts/artifacts/src/StoreManager.sol/LogStoreManager.json';
import {
	getQueryManagerContract,
	prepareStakeForQueryManager,
	prepareStakeForStoreManager,
} from '@concertodao/logstore-shared';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { Provider } from '@ethersproject/providers';
import {
	Authentication,
	AuthenticationInjectionToken,
	collect,
	ContractFactory,
	LoggerFactory,
	queryAllReadonlyContracts,
	Stream,
	StreamIDBuilder,
	waitForTx,
} from '@streamr-client';
import { toStreamID } from '@streamr/protocol';
import { Logger, toEthereumAddress } from '@streamr/utils';
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
	private clientConfig: Pick<StrictLogStoreClientConfig, 'contracts'>;
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
		clientConfig: Pick<StrictLogStoreClientConfig, 'contracts'>
	) {
		this.contractFactory = contractFactory;
		this.logStoreClient = logStoreClient;
		this.streamIdBuilder = streamIdBuilder;
		this.graphQLClient = graphQLClient;
		this.eventEmitter = eventEmitter;
		this.authentication = authentication;
		this.clientConfig = clientConfig;
		this.logger = loggerFactory.createLogger(module);
		this.logStoreManagerContractsReadonly = getStreamRegistryChainProviders(
			clientConfig
		).map((provider: Provider) => {
			return this.contractFactory.createReadContract(
				toEthereumAddress(
					this.clientConfig.contracts.logStoreStoreManagerChainAddress
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
						this.clientConfig.contracts.logStoreStoreManagerChainAddress
					),
					LogStoreManagerAbi,
					chainSigner,
					'logStoreManager'
				);
		}
	}

	async stakeOrCreateStore(
		streamIdOrPath: string,
		amount: bigint
	): Promise<void> {
		const streamId = await this.streamIdBuilder.toStreamID(streamIdOrPath);
		this.logger.debug('adding stream %s to LogStore', streamId);
		await this.connectToContract();
		this.logger.debug('approving LogStore contract for token funds', streamId);
		// @dev 'chainSigner' could either be a wallet or a signer
		// @dev depending on if a pk was passed into the contract
		const chainSigner =
			await this.authentication.getStreamRegistryChainSigner();
		await prepareStakeForStoreManager(chainSigner, amount, false);
		const ethersOverrides = getStreamRegistryOverrides(this.clientConfig);
		await waitForTx(
			this.logStoreManagerContract!.stake(streamId, amount, ethersOverrides)
		);
	}

	async queryStake(
		amount: BigNumberish,
		options = { usd: false }
	): Promise<void> {
		const chainSigner =
			await this.authentication.getStreamRegistryChainSigner();
		const stakeAmount = prepareStakeForQueryManager(
			chainSigner,
			Number(amount),
			options.usd
		);
		const queryManagerContract = await getQueryManagerContract(chainSigner);
		await (await queryManagerContract.stake(stakeAmount)).wait();
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
