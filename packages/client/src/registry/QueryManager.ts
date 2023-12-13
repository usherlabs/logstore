import { BigNumberish } from '@ethersproject/bignumber';
import { ContractReceipt, type Overrides } from '@ethersproject/contracts';
import { Provider } from '@ethersproject/providers';
import { LogStoreQueryManager as QueryManagerContract } from '@logsn/contracts';
import { abi as QueryManagerAbi } from '@logsn/contracts/artifacts/src/QueryManager.sol/LogStoreQueryManager.json';
import { prepareStakeForQueryManager } from '@logsn/shared';
import {
	ContractFactory,
	LoggerFactory,
	queryAllReadonlyContracts,
	waitForTx,
} from '@logsn/streamr-client';
import { Logger, toEthereumAddress } from '@streamr/utils';
import { inject, Lifecycle, scoped } from 'tsyringe';

import {
	LogStoreClientConfigInjectionToken,
	StrictLogStoreClientConfig,
} from '../Config';
import {
	getStreamRegistryChainProviders,
	getStreamRegistryOverrides,
} from '../Ethereum';
import {
	Authentication,
	AuthenticationInjectionToken,
} from '../streamr/Authentication';
import {
	StreamrClientConfigInjectionToken,
	StrictStreamrClientConfig,
} from '../streamr/Config';

@scoped(Lifecycle.ContainerScoped)
export class QueryManager {
	private contractFactory: ContractFactory;
	private authentication: Authentication;
	private logStoreClientConfig: Pick<StrictLogStoreClientConfig, 'contracts'>;
	private streamrClientConfig: Pick<StrictStreamrClientConfig, 'contracts'>;
	private readonly queryManagerContractsReadonly: QueryManagerContract[];
	private queryManagerContract?: QueryManagerContract;
	private readonly logger: Logger;

	constructor(
		@inject(ContractFactory)
		contractFactory: ContractFactory,
		@inject(LoggerFactory)
		loggerFactory: LoggerFactory,
		@inject(AuthenticationInjectionToken)
		authentication: Authentication,
		@inject(StreamrClientConfigInjectionToken)
		streamrClientConfig: Pick<StrictStreamrClientConfig, 'contracts'>,
		@inject(LogStoreClientConfigInjectionToken)
		logStoreClientConfig: Pick<StrictLogStoreClientConfig, 'contracts'>
	) {
		this.contractFactory = contractFactory;
		this.logStoreClientConfig = logStoreClientConfig;
		this.streamrClientConfig = streamrClientConfig;
		this.logger = loggerFactory.createLogger(module);
		this.authentication = authentication;
		this.queryManagerContractsReadonly = getStreamRegistryChainProviders(
			this.streamrClientConfig
		).map((provider: Provider) => {
			return this.contractFactory.createReadContract(
				toEthereumAddress(
					this.logStoreClientConfig.contracts.logStoreQueryManagerChainAddress
				),
				QueryManagerAbi,
				provider,
				'queryManager'
			) as QueryManagerContract;
		});
	}

	private async connectToContract() {
		if (!this.queryManagerContract) {
			this.logger.debug('Getting stream registry chain signer...');
			const chainSigner =
				await this.authentication.getStreamRegistryChainSigner();
			this.logger.debug('Successfully obtained stream registry chain signer.');

			this.queryManagerContract =
				this.contractFactory.createWriteContract<QueryManagerContract>(
					toEthereumAddress(
						this.logStoreClientConfig.contracts.logStoreQueryManagerChainAddress
					),
					QueryManagerAbi,
					chainSigner,
					'queryManager'
				);
			this.logger.debug('Successfully connected to QueryManager contract.');
		}
	}

	async getQueryBalance(): Promise<bigint> {
		this.logger.debug('Getting query balance for same account...');
		const address = await this.authentication.getAddress();
		const balance = await this.getQueryBalanceOf(address);
		return balance;
	}

	async getQueryBalanceOf(account: string): Promise<bigint> {
		this.logger.debug(`Getting query balance of account ${account}...`);
		const balance = await queryAllReadonlyContracts((contract) => {
			return contract.balanceOf(account).then((b) => b.toBigInt());
		}, this.queryManagerContractsReadonly);
		this.logger.debug(`Query balance of account ${account} is ${balance}`);
		return balance;
	}

	async queryStake(
		amount: BigNumberish,
		options = { usd: false },
		overrides?: Overrides
	): Promise<ContractReceipt> {
		this.logger.debug(
			`Staking ${amount} with options: ${JSON.stringify(options)}...`
		);

		const chainSigner =
			await this.authentication.getStreamRegistryChainSigner();

		await this.connectToContract();
		const stakeAmount = prepareStakeForQueryManager(
			chainSigner,
			Number(amount),
			options.usd
		);
		this.logger.debug(`Stake amount prepared: ${stakeAmount}`);

		const ethersOverrides = getStreamRegistryOverrides(
			this.streamrClientConfig
		);
		return waitForTx(
			this.queryManagerContract!.stake(stakeAmount, {
				...ethersOverrides,
				...overrides,
			})
		);
	}
}
