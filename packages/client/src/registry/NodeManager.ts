import { Provider } from '@ethersproject/providers';
import { LogStoreNodeManager as LogStoreNodeManagerContract } from '@logsn/contracts';
import { abi as LogStoreNodeManagerAbi } from '@logsn/contracts/artifacts/src/NodeManager.sol/LogStoreNodeManager.json';
import {
	type EthereumAddress,
	Logger,
	toEthereumAddress,
} from '@streamr/utils';
import pThrottle from 'p-throttle';
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
	timeout,
	timer,
} from 'rxjs';
import StreamrClient from 'streamr-client';
import { inject, Lifecycle, scoped } from 'tsyringe';

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

@scoped(Lifecycle.ContainerScoped)
export class NodeManager {
	private contractFactory: ContractFactory;
	private logStoreClientConfig: Pick<StrictLogStoreClientConfig, 'contracts'>;
	private streamrClientConfig: Pick<StrictStreamrClientConfig, 'contracts'>;
	private readonly logStoreManagerContractsReadonly: LogStoreNodeManagerContract[];
	private readonly logger: Logger;
	private readonly nodeUrlCache = new AsyncStaleThenRevalidateCache<
		EthereumAddress,
		string | null
	>({
		maxAge: 300_000, // 5 min
	});

	// ==== Node URL List Management ====
	// replay subject emits the last value to new subscribers. But if there's no value, it won't emit until it does.
	private readonly lastList$ = new ReplaySubject<string[]>(1);
	// throttledUpdateList will help us to update the lastList$ with the timedNodeUrlListByLatency$ output at most once every X minutes.
	private throttledUpdateList = () => Promise<void>;

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

		// throttledUpdateList is a function that, when called, updates the lastList$ with the timedNodeUrlListByLatency$ output.
		// Remembering that timedNodeUrlListByLatency$ automatically completes after 3 seconds, avoiding memory leaks and unfinished searches.
		// This function is throttled to run at most once every minute.
		// Also, we're able to get the lastList$ value instantly, as soon as the first heartbeat message arrives.
		this.throttledUpdateList = pThrottle({ limit: 1, interval: 60_000 })(() => {
			this.timedNodeUrlListByLatency$.subscribe({
				next: (list) => {
					this.lastList$.next(list);
				},
			});
		});
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
	 * Returns an observable that emits a list of the most performant node URLs,
	 * sorted in order of their lag-time (from lowest to highest).
	 */
	public get nodeUrlListByLatency$() {
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

		// gets messages to the format [url, lagTime]
		const urlAndLagTime$ = heartbeatMessage$.pipe(
			// merge map is used because it's a Promise. We need to wait for the promise to resolve.
			mergeMap(async ([_content, metadata]) => {
				// calculates the lag time
				// we know the message timestamp is the time the message was published, and we can compare it to the current time
				const lagTime = Date.now() - metadata.timestamp;
				const url = await this.getNodeUrl(metadata.publisherId);
				return [url, lagTime] as const;
			}),
			// filters nodes without a url. Nodes can join the network without a url, but they won't be considered here.
			filter((values): values is [string, number] => {
				const [url] = values;
				return url !== null;
			})
		);

		return urlAndLagTime$.pipe(
			// creates a map of URLs to lagTime
			// map is used so there's no repeated URL
			scan((acc, [url, lagTime]) => {
				acc.set(url, lagTime);
				return acc;
			}, new Map<string, number>()),
			// audit is like throttle but emits the last value instead of the first.
			// avoids emitting a new value for every heartbeat message, like a batch.
			auditTime(10), // in milliseconds
			// orders the output list by lagTime, ascending
			map((nodeMap) =>
				Array.from(nodeMap.entries()).sort((a, b) => a[1] - b[1])
			),
			map((nodeList) => nodeList.map(([url]) => url)),
			// Share so that if the user also subscribes directly,
			// it wouldn't create another subscription, but reuse the same.
			share()
		);
	}

	/**
	 * Initially, the observable listens to the heartbeat stream for three seconds before stopping.
	 * Exceptions are made if there are no heartbeats in a while - in such case, the search will continue indefinitely
	 * until at least one heatbeat is found.
	 *
	 * The maximum time to wait for the first heartbeat is 15 seconds, otherwise it should throw a timeout error.
	 * @private
	 */
	private get timedNodeUrlListByLatency$() {
		return this.nodeUrlListByLatency$.pipe(
			// We should take until 3 seconds, but this timer should start after the first value is emitted.
			takeUntilWithFilter((list) => list.length > 0, timer(3_000)),
			// Emits a value just if there's one url or more. This function cannot return an empty list.
			filter((urlList) => urlList.length > 0),
			// Should emit at least one-value list within 15 seconds.
			// If didn't receive any data until then, it's an error.
			timeout(15_000)
		);
	}

	public async getBestNodeUrls() {
		this.throttledUpdateList();
		return firstValueFrom(this.lastList$);
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
}
