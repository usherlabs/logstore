import { Provider } from '@ethersproject/providers';
import { LogStoreNodeManager as LogStoreNodeManagerContract } from '@logsn/contracts';
import { abi as LogStoreNodeManagerAbi } from '@logsn/contracts/artifacts/src/NodeManager.sol/LogStoreNodeManager.json';
import {
	type EthereumAddress,
	Logger,
	toEthereumAddress,
} from '@streamr/utils';
import {
	auditTime,
	defer,
	filter,
	firstValueFrom,
	map,
	mergeMap,
	ReplaySubject,
	scan,
	share,
	Subject,
	takeUntil,
	timeout,
	timer,
} from 'rxjs';
import StreamrClient from 'streamr-client';
import { inject, Lifecycle, scoped } from 'tsyringe';
import type * as lodash from 'lodash';
import { throttle } from 'lodash';

import {
	LogStoreClientConfigInjectionToken,
	StrictLogStoreClientConfig,
} from '../Config';
import { getStreamRegistryChainProviders } from '../Ethereum';
import { NodeMetadata } from '../NodeMetadata';
import {
	StreamrClientConfigInjectionToken,
	StrictStreamrClientConfig,
} from '../streamr/Config';
import {
	ContractFactory,
	ContractFactoryInjectionToken,
} from '../streamr/ContractFactory';
import {
	LoggerFactory,
	LoggerFactoryInjectionToken,
} from '../streamr/LoggerFactory';
import { StreamrClientInjectionToken } from '../streamr/StreamrClient';
import { queryAllReadonlyContracts } from '../streamr/utils/contract';
import { AsyncStaleThenRevalidateCache } from '../utils/AsyncStaleThenRevalidateCache';
import { createBroadbandObservable } from '../utils/rxjs/BroadbandObservable';
import { takeUntilWithFilter } from '../utils/rxjs/takeUntilWithFilter';

type HeartbeatInfo = {
	/// Node address
	nodeAddress: EthereumAddress;
	/// Date of the heartbeat
	publishDate: Date;
	/// in milliseconds
	latency: number;
};

@scoped(Lifecycle.ContainerScoped)
export class NodeManager {
	private contractFactory: ContractFactory;
	private logStoreClientConfig: Pick<StrictLogStoreClientConfig, 'contracts'>;
	private streamrClientConfig: Pick<StrictStreamrClientConfig, 'contracts'>;
	private readonly logStoreManagerContractsReadonly: LogStoreNodeManagerContract[];
	private readonly logger: Logger;
	private readonly abort$ = new Subject<1>();
	private readonly nodeUrlCache = new AsyncStaleThenRevalidateCache<
		EthereumAddress,
		string | null
	>({
		maxAge: 300_000, // 5 min
	});

	// ==== Node URL List Management ====
	// replay subject emits the last value to new subscribers. But if there's no value, it won't emit until it does.
	private readonly lastUrlList$ = new ReplaySubject<string[]>(1);
	// throttledUpdateList will help us to update the lastUrlList$ with the node information output at most once every X minutes.
	private throttledUpdateList: lodash.DebouncedFunc<() => unknown> = throttle(
		() => {},
		60_000
	);

	// ==================================

	constructor(
		@inject(ContractFactoryInjectionToken)
		contractFactory: ContractFactory,
		@inject(LoggerFactoryInjectionToken)
		loggerFactory: LoggerFactory,
		@inject(LogStoreClientConfigInjectionToken)
		logStoreClientConfig: Pick<StrictLogStoreClientConfig, 'contracts'>,
		@inject(StreamrClientConfigInjectionToken)
		streamrClientConfig: Pick<StrictStreamrClientConfig, 'contracts'>,
		@inject(StreamrClientInjectionToken)
		private streamrClient: StreamrClient
	) {
		this.contractFactory = contractFactory;
		this.logStoreClientConfig = logStoreClientConfig;
		this.streamrClientConfig = streamrClientConfig;
		this.logger = loggerFactory.createLogger(module);
		this.logStoreManagerContractsReadonly = getStreamRegistryChainProviders(
			this.streamrClientConfig
		).map((provider: Provider) => {
			return this.contractFactory.createReadContract(
				toEthereumAddress(
					this.logStoreClientConfig.contracts.logStoreNodeManagerChainAddress
				),
				LogStoreNodeManagerAbi,
				provider,
				'logStoreNodeManager'
			) as LogStoreNodeManagerContract;
		});

		// This function is throttled to run at most once every minute.
		// Also, we're able to get the lastUrlList$ value instantly, as soon as the first heartbeat message arrives.
		this.throttledUpdateList = throttle(
			() => this.updateNodeUrlList(),
			60_000,
			{ leading: true }
		);
		this.throttledUpdateList();
	}

	private getNodeFromAddress = async (address: string) => {
		return queryAllReadonlyContracts(
			(contract: LogStoreNodeManagerContract) => {
				return contract.nodes(address);
			},
			this.logStoreManagerContractsReadonly
		);
	};

	private parseMetadata = (metadata: string) => {
		try {
			return JSON.parse(metadata) as NodeMetadata;
		} catch (e) {
			this.logger.error(`Error parsing metadata: ${e}`);
			throw e;
		}
	};

	/**
	 * Returns an observable that emits a list nodes,
	 * sorted in order of their latency (from lowest to highest).
	 * Latency is calculated from the time the message was published to the time it was received.
	 */
	public get nodeListByLatency$() {
		const heartbeatStreamAddress =
			this.logStoreClientConfig.contracts.logStoreNodeManagerChainAddress +
			'/heartbeat';

		// from promise to observable
		const heartbeatStream$ = defer(() =>
			this.streamrClient.getStream(heartbeatStreamAddress)
		);

		const heartbeatMessage$ = heartbeatStream$.pipe(
			// merge map is used because the result is also an observable that we want to subscribe to.
			mergeMap((stream) =>
				createBroadbandObservable(this.streamrClient, stream)
			)
		);

		const heartbeatInfo$ = heartbeatMessage$.pipe(
			// merge map is used because it's a Promise. We need to wait for the promise to resolve.
			mergeMap(async ([_content, metadata]) => {
				// calculates the lag time
				// we know the message timestamp is the time the message was published, and we can compare it to the current time
				const latency = Date.now() - metadata.timestamp;
				return {
					nodeAddress: metadata.publisherId,
					publishDate: new Date(metadata.timestamp),
					latency,
				} satisfies HeartbeatInfo;
			})
		);

		return heartbeatInfo$.pipe(
			// creates a map of EthereumAddress to latency
			// map is used so there's no repeated EthereumAddress
			scan((acc, info) => {
				acc.set(info.nodeAddress, info);
				return acc;
			}, new Map<EthereumAddress, HeartbeatInfo>()),
			// audit is like throttle but emits the last value instead of the first.
			// avoids emitting a new value for every heartbeat message, like a batch.
			auditTime(10), // in milliseconds
			// orders the output list by latency, ascending
			map((nodeMap) =>
				Array.from(nodeMap.entries()).sort(
					(a, b) => a[1].latency - b[1].latency
				)
			),
			// extract only heartbeat information
			map((nodeList) => nodeList.map((infoMap) => infoMap[1])),
			// Share so that if the user also subscribes directly,
			// it wouldn't create another subscription, but reuse the same.
			share()
		);
	}

	/**
	 * updateNodeUrl is a function that, when called, updates the lastUrlList$
	 *
	 * Steps:
	 *
	 * - Transforms the list of addresses in a list of URLs.
	 * - After subscription, a counter is initiated after 3 seconds after the first URL is found.
	 * - Otherwise it runs and times out after 15 seconds.
	 * @private
	 */
	private updateNodeUrlList() {
		this.nodeListByLatency$
			.pipe(
				// transform node addresses into URLs
				mergeMap((heartbeatInfoList) =>
					Promise.all(
						heartbeatInfoList.map((info) => this.getNodeUrl(info.nodeAddress))
					)
				),
				// remove nulls -- nodes that choose not to expose a gateway
				map((urlList) => urlList.filter((url): url is string => url !== null)),
				// We should take until 3 seconds, but this timer should start after the first value is emitted.
				takeUntilWithFilter((list) => list.length > 0, timer(3_000)),
				// Emits a value just if there's one url or more. This function cannot return an empty list.
				filter((urlList) => urlList.length > 0),
				// Should emit at least one-value list within 15 seconds.
				// If didn't receive any data until then, it's an error.
				timeout(15_000),
				takeUntil(this.abort$)
			)
			// we subscribe indefinetely, but we don't worry about memory leak because it completes after 3 or 15 seconds.
			.subscribe({
				next: (list) => {
					this.lastUrlList$.next(list);
				},
				error: (e) => {
					this.logger.error('Error getting node URL list', e);
				},
			});
	}

	public async getNodeUrlsByLatency() {
		this.throttledUpdateList();
		// should be instant, as the lastUrlList$ is a replay subject
		// however if the lastUrlList$ is empty, it will wait for the first value to be emitted
		// and it should throw a timeout error if something goes wrong.
		return firstValueFrom(this.lastUrlList$.pipe(timeout(15_000)));
	}

	public async getNodeAddressFromUrl(url: string): Promise<string | null> {
		const nodeAddresses = await this.getActiveNodes();

		for (const nodeAddress of nodeAddresses) {
			const node = await this.getNodeFromAddress(nodeAddress);
			if (node.metadata.includes(url)) {
				return nodeAddress;
			}
		}

		return null;
	}

	public async getNodeUrl(
		nodeAddress: EthereumAddress,
		useCache = true
	): Promise<string | null> {
		if (useCache) {
			const cachedUrl = this.nodeUrlCache.get(nodeAddress, async () =>
				this.getNodeUrl(nodeAddress, false)
			);
			if (cachedUrl) {
				return cachedUrl;
			}
		}

		const node = await this.getNodeFromAddress(nodeAddress);
		if (node.metadata.includes('http')) {
			try {
				const metadata = this.parseMetadata(node.metadata);
				return metadata.http ?? null;
			} catch (e) {
				this.logger.error(`Error parsing metadata: ${e}`);
			}
		}
		return null;
	}

	public async getActiveNodes() {
		return queryAllReadonlyContracts(
			(contract: LogStoreNodeManagerContract) => {
				return contract.nodeAddresses();
			},
			this.logStoreManagerContractsReadonly
		);
	}

	public destroy() {
		this.abort$.next(1);
		this.lastUrlList$.complete();
		this.throttledUpdateList.cancel();
	}

	[Symbol.dispose]() {
		this.destroy();
	}
}
