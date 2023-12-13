import { Provider } from '@ethersproject/providers';
import { LogStoreNodeManager as LogStoreNodeManagerContract } from '@logsn/contracts';
import { abi as LogStoreNodeManagerAbi } from '@logsn/contracts/artifacts/src/NodeManager.sol/LogStoreNodeManager.json';
import { Logger, toEthereumAddress } from '@streamr/utils';
import { shuffle } from 'lodash';
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
import { queryAllReadonlyContracts } from '../streamr/utils/contract';

@scoped(Lifecycle.ContainerScoped)
export class NodeManager {
	private contractFactory: ContractFactory;
	private logStoreClientConfig: Pick<StrictLogStoreClientConfig, 'contracts'>;
	private streamrClientConfig: Pick<StrictStreamrClientConfig, 'contracts'>;
	private readonly logStoreManagerContractsReadonly: LogStoreNodeManagerContract[];
	private readonly logger: Logger;

	constructor(
		@inject(ContractFactoryInjectionToken)
		contractFactory: ContractFactory,
		@inject(LoggerFactoryInjectionToken)
		loggerFactory: LoggerFactory,
		@inject(LogStoreClientConfigInjectionToken)
		logStoreClientConfig: Pick<StrictLogStoreClientConfig, 'contracts'>,
		@inject(StreamrClientConfigInjectionToken)
		streamrClientConfig: Pick<StrictStreamrClientConfig, 'contracts'>
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
	}

	async getRandomNodeUrl() {
		const nodeAddresses = shuffle(
			await queryAllReadonlyContracts(
				(contract: LogStoreNodeManagerContract) => {
					return contract.nodeAddresses();
				},
				this.logStoreManagerContractsReadonly
			)
		);

		for (const nodeAddress of nodeAddresses) {
			const node = await queryAllReadonlyContracts(
				(contract: LogStoreNodeManagerContract) => {
					return contract.nodes(nodeAddress);
				},
				this.logStoreManagerContractsReadonly
			);
			if (node.metadata.includes('http')) {
				try {
					const metadata = JSON.parse(node.metadata) as NodeMetadata;
					return metadata.http;
				} catch (e) {
					// ...
				}
			}
		}

		throw new Error('There are no nodes with a proper metadata');
	}

	public async getNodeAddressFromUrl(url: string) {
		const nodeAddresses = await queryAllReadonlyContracts(
			(contract: LogStoreNodeManagerContract) => {
				return contract.nodeAddresses();
			},
			this.logStoreManagerContractsReadonly
		);

		for (const nodeAddress of nodeAddresses) {
			const node = await queryAllReadonlyContracts(
				(contract: LogStoreNodeManagerContract) => {
					return contract.nodes(nodeAddress);
				},
				this.logStoreManagerContractsReadonly
			);
			if (node.metadata.includes(url)) {
				return nodeAddress;
			}
		}

		throw new Error('There are no nodes with a proper metadata');
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
