import type { LogStoreManager as LogStoreManagerContract } from '@concertodao/logstore-contracts';
import { abi as LogStoreManagerAbi } from '@concertodao/logstore-contracts/artifacts/src/StoreManager.sol/LogStoreManager.json';
import {
	getQueryManagerContract,
	prepareStakeForQueryManager,
	prepareStakeForStoreManager,
} from '@concertodao/logstore-shared';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { Provider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import { toStreamID, toStreamPartID } from '@streamr/protocol';
import {
	EthereumAddress,
	Logger,
	toEthereumAddress,
	withTimeout,
} from '@streamr/utils';
import { min } from 'lodash';
import { MessageMetadata, Stream } from 'streamr-client';
import { delay, inject, Lifecycle, scoped } from 'tsyringe';

import {
	Authentication,
	AuthenticationInjectionToken,
} from '../Authentication';
import {
	LogStoreClientConfigInjectionToken,
	StrictLogStoreClientConfig,
} from '../Config';
import { ContractFactory } from '../ContractFactory';
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
import { DEFAULT_PARTITION, StreamIDBuilder } from '../StreamIDBuilder';
import { queryAllReadonlyContracts, waitForTx } from '../utils/contract';
import { collect } from '../utils/iterators';
import { LoggerFactory } from '../utils/LoggerFactory';
import { SynchronizedGraphQLClient } from '../utils/SynchronizedGraphQLClient';
import { formLogStoreSystemStreamId } from '../utils/utils';

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
					this.clientConfig.contracts.logStoreManagerChainAddress
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
		// this.initStreamAssignmentEventListener(
		// 	'addToLogStore',
		// 	'Added',
		// 	eventEmitter
		// );
		// this.initStreamAssignmentEventListener(
		// 	'removeFromLogStore',
		// 	'Removed',
		// 	eventEmitter
		// );
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
						this.clientConfig.contracts.logStoreManagerChainAddress
					),
					LogStoreManagerAbi,
					chainSigner,
					'logStoreManager'
				);
		}
	}

	/**
	 * Assigns the stream to a storage node.
	 *
	 * @category Important
	 *
	 * @param waitOptions - control how long to wait for storage node to pick up on assignment
	 * @returns a resolved promise if (1) stream was assigned to storage node and (2) the storage node acknowledged the
	 * assignment within `timeout`, otherwise rejects. Notice that is possible for this promise to reject but for the
	 * storage node assignment to go through eventually.
	 */
	async addToStorageNode(
		streamIdOrPath: string,
		stakeAmount = BigNumber.from('100000000000000000'),
		waitOptions: { timeout?: number } = {}
	): Promise<void> {
		// let assignmentSubscription: Subscription;
		const normalizedNodeAddress = toEthereumAddress(
			this.clientConfig.contracts.logStoreManagerChainAddress
		);
		// const normalizedNodeAddress = toEthereumAddress(storageNodeAddress);
		try {
			const streamPartId = toStreamPartID(
				formLogStoreSystemStreamId(normalizedNodeAddress),
				DEFAULT_PARTITION
			);

			// TODO: Perhaps a review is required here. The source logic: Stream.addToStorageNode() with waitForAssignmentsToPropagate()
			const propagationPromise = new Promise((resolve, reject) => {
				this.logStoreClient
					.subscribe(
						streamPartId,
						(content: unknown, metadata: MessageMetadata) => {
							this.logger.debug('assignmentSubscription %s', {
								content,
								metadata,
							});
							resolve(content);
						}
					)
					.catch((err) => {
						this.logger.error(err);
						reject(err);
					});
			});

			await this.stakeOrCreateStore(streamIdOrPath, stakeAmount);

			// TODO: Take timeouts from config
			await withTimeout(
				propagationPromise,
				// eslint-disable-next-line no-underscore-dangle
				waitOptions.timeout ?? 30000,
				// waitOptions.timeout ?? this._config._timeouts.storageNode.timeout,
				'storage node did not respond'
			);
		} finally {
			// TODO: Research what streamRegistryCached.clearStream() does
			// this._streamRegistryCached.clearStream(this.id);
			// await assignmentSubscription?.unsubscribe(); // should never reject...
		}
	}

	async stakeOrCreateStore(
		streamIdOrPath: string,
		amount: BigNumberish
	): Promise<void> {
		const streamId = await this.streamIdBuilder.toStreamID(streamIdOrPath);
		this.logger.debug('adding stream %s to LogStore', streamId);
		await this.connectToContract();
		this.logger.debug('approving LogStore contract for token funds', streamId);
		// @dev 'chainSigner' could either be a wallet or a signer
		// @dev depending on if a pk was passed into the contract
		const chainSigner =
			await this.authentication.getStreamRegistryChainSigner();
		await prepareStakeForStoreManager(
			chainSigner as Wallet,
			Number(amount),
			false
		);
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
			(await this.authentication.getStreamRegistryChainSigner()) as Wallet;
		const stakeAmount = prepareStakeForQueryManager(
			chainSigner,
			Number(amount),
			options.usd
		);
		// @todo rename function to getQueryMangerContract across repo
		const queryManagerContract = await getQueryManagerContract(chainSigner);
		await (await queryManagerContract.stake(stakeAmount)).wait();
	}

	async removeStreamFromLogStore(streamIdOrPath: string): Promise<void> {
		const streamId = await this.streamIdBuilder.toStreamID(streamIdOrPath);
		this.logger.debug('removing stream %s from LogStore', streamId);
		await this.connectToContract();
		// const ethersOverrides = getStreamRegistryOverrides(this.config);
		// await waitForTx(
		// 	this.streamStorageRegistryContract!.removeStorageNode(
		// 		streamId,
		// 		nodeAddress,
		// 		ethersOverrides
		// 	)
		// );
	}

	async isLogStoreStream(streamIdOrPath: string): Promise<boolean> {
		const streamId = await this.streamIdBuilder.toStreamID(streamIdOrPath);
		this.logger.debug('querying if stream %s is in LogStore', streamId);
		return queryAllReadonlyContracts((contract: LogStoreManagerContract) => {
			return contract.exists(streamId);
		}, this.logStoreManagerContractsReadonly);
		// return queryAllReadonlyContracts(
		// 	(contract: StreamStorageRegistryContract) => {
		// 		return contract.isStorageNodeOf(streamId, nodeAddress);
		// 	},
		// 	this.streamStorageRegistryContractsReadonly
		// );
	}

	// async getStoredStreams(
	// 	nodeAddress: EthereumAddress
	// ): Promise<{ streams: Stream[]; blockNumber: number }> {
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
					// 					const query = `
					// {
					// 	storeUpdateds(first: ${pageSize}, orderBy: store, where: {store_gt: "${lastId}"}) {
					// 		store
					// 	}
					// 	_meta {
					// 		deployment
					// 		block {
					// 			number
					// 		}
					// 	}
					// }`;
					// const query = `{
					//           node (id: "${nodeAddress}") {
					//               id
					//               metadata
					//               lastSeen
					//               storedStreams (first: ${pageSize} orderBy: "id" where: { id_gt: "${lastId}"}) {
					//                   id,
					//                   metadata
					//               }
					//           }
					//           _meta {
					//               block {
					//                   number
					//               }
					//           }
					//       }`;
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
						// return await this.streamrClient.createStream(
						// 	toStreamID(storeUpdated.store)
						// );
					} catch (err) {
						this.logger.error(err);
						return null;
					}
				})
			)
		).filter((stream) => stream != null) as Stream[];

		// const streams = [] as Stream[];

		this.logger.debug(
			'streams: %s',
			JSON.stringify(
				streams.map((stream) => stream.id.toString()),
				null,
				2
			)
		);
		// const streams = res.map((stream: any) => {
		// 	const props = Stream.parseMetadata(stream.metadata);
		// 	return this.streamFactory.createStream(toStreamID(stream.id), props); // toStreamID() not strictly necessary
		// });
		return {
			streams,
			blockNumber: min(blockNumbers)!,
		};
	}

	async getStorageNodes(streamIdOrPath?: string): Promise<EthereumAddress[]> {
		this.logger.debug('getStorageNodes %s', streamIdOrPath);
		return [];

		// let queryResults: NodeQueryResult[];
		// if (streamIdOrPath !== undefined) {
		// 	const streamId = await this.streamIdBuilder.toStreamID(streamIdOrPath);
		// 	this.logger.debug('getting storage nodes of stream %s', streamId);
		// 	queryResults = await collect(
		// 		this.graphQLClient.fetchPaginatedResults<NodeQueryResult>(
		// 			(lastId: string, pageSize: number) => {
		// 				const query = `{
		//                     stream (id: "${streamId}") {
		//                         id
		//                         metadata
		//                         storageNodes (first: ${pageSize} orderBy: "id" where: { id_gt: "${lastId}"}) {
		//                             id
		//                             metadata
		//                             lastSeen
		//                         }
		//                     }
		//                 }`;
		// 				return { query };
		// 			},
		// 			(response: any) => {
		// 				return response.stream !== null ? response.stream.storageNodes : [];
		// 			}
		// 		)
		// 	);
		// } else {
		// 	this.logger.debug('getting all storage nodes');
		// 	queryResults = await collect(
		// 		this.graphQLClient.fetchPaginatedResults<NodeQueryResult>(
		// 			(lastId: string, pageSize: number) => {
		// 				const query = `{
		//                     nodes (first: ${pageSize} orderBy: "id" where: { id_gt: "${lastId}"}) {
		//                         id
		//                         metadata
		//                         lastSeen
		//                     }
		//                 }`;
		// 				return { query };
		// 			}
		// 		)
		// 	);
		// }
		// return queryResults.map((node) => toEthereumAddress(node.id));
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
