import { Provider } from '@ethersproject/providers';
import { LogStoreNodeManager as LogStoreNodeManagerContract } from '@logsn/contracts';
import { abi as LogStoreNodeManagerAbi } from '@logsn/contracts/artifacts/src/NodeManager.sol/LogStoreNodeManager.json';
import { Logger, toEthereumAddress } from '@streamr/utils';
import { shuffle } from 'lodash';
import { inject, Lifecycle, scoped } from 'tsyringe';
import {
	ContractFactory,
	LoggerFactory,
	queryAllReadonlyContracts,
} from '~streamr-client';

import {
	LogStoreClientConfigInjectionToken,
	StrictLogStoreClientConfig,
} from '../Config';
import { getStreamRegistryChainProviders } from '../Ethereum';
import { NodeMetadata } from '../NodeMetadata';

@scoped(Lifecycle.ContainerScoped)
export class NodeManager {
	private contractFactory: ContractFactory;
	private clientConfig: Pick<StrictLogStoreClientConfig, 'contracts'>;
	private readonly logStoreManagerContractsReadonly: LogStoreNodeManagerContract[];
	private readonly logger: Logger;

	constructor(
		@inject(ContractFactory)
		contractFactory: ContractFactory,
		@inject(LoggerFactory)
		loggerFactory: LoggerFactory,
		@inject(LogStoreClientConfigInjectionToken)
		clientConfig: Pick<StrictLogStoreClientConfig, 'contracts'>
	) {
		this.contractFactory = contractFactory;
		this.clientConfig = clientConfig;
		this.logger = loggerFactory.createLogger(module);
		this.logStoreManagerContractsReadonly = getStreamRegistryChainProviders(
			clientConfig
		).map((provider: Provider) => {
			return this.contractFactory.createReadContract(
				toEthereumAddress(
					this.clientConfig.contracts.logStoreNodeManagerChainAddress
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
}
