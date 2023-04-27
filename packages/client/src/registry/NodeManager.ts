import { LogStoreNodeManager as LogStoreNodeManagerContract } from '@concertodao/logstore-contracts';
import { abi as LogStoreNodeManagerAbi } from '@concertodao/logstore-contracts/artifacts/src/NodeManager.sol/LogStoreNodeManager.json';
import { Provider } from '@ethersproject/providers';
import { Logger, toEthereumAddress } from '@streamr/utils';
import { shuffle } from 'lodash';
import { inject, Lifecycle, scoped } from 'tsyringe';

import {
	LogStoreClientConfigInjectionToken,
	StrictLogStoreClientConfig,
} from '../Config';
import { ContractFactory } from '../ContractFactory';
import { getStreamRegistryChainProviders } from '../Ethereum';
import { queryAllReadonlyContracts } from '../utils/contract';
import { LoggerFactory } from '../utils/LoggerFactory';

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
			if (node.metadata.startsWith('http')) {
				return node.metadata;
			}
		}

		throw new Error('There are no nodes with a proper metadata');
	}
}
