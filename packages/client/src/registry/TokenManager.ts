import { BigNumberish } from '@ethersproject/bignumber';
import type { Overrides } from '@ethersproject/contracts';
import { Provider } from '@ethersproject/providers';
import { LSAN as LogStoreTokenManagerContract } from '@logsn/contracts';
import { abi as LogStoreTokenManagerAbi } from '@logsn/contracts/artifacts/src/alpha/Token.sol/LSAN.json';
import { getMaticPrice } from '@logsn/shared';
import {
	ContractFactory,
	queryAllReadonlyContracts,
} from '@logsn/streamr-client';
import { ObservableContract } from '@logsn/streamr-client/dist/types/src/utils/contract';
import { Logger, toEthereumAddress } from '@streamr/utils';
import Decimal from 'decimal.js';
import { ContractTransaction } from 'ethers';
import { inject, Lifecycle, scoped } from 'tsyringe';

import {
	LogStoreClientConfigInjectionToken,
	StrictLogStoreClientConfig,
} from '../Config';
import { getStreamRegistryChainProviders } from '../Ethereum';
import {
	Authentication,
	AuthenticationInjectionToken,
} from '../streamr/Authentication';
import {
	StreamrClientConfigInjectionToken,
	StrictStreamrClientConfig,
} from '../streamr/Config';
import {
	LoggerFactory,
	LoggerFactoryInjectionToken,
} from '../streamr/LoggerFactory';
import { AmountTypes } from '../types';

@scoped(Lifecycle.ContainerScoped)
export class TokenManager {
	private contractFactory: ContractFactory;
	private authentication: Authentication;
	private logStoreClientConfig: Pick<StrictLogStoreClientConfig, 'contracts'>;
	private streamrClientConfig: Pick<StrictStreamrClientConfig, 'contracts'>;
	private logStoreTokenManagerContract?: ObservableContract<LogStoreTokenManagerContract>;
	private readonly logstoreTokenManagerContractsReadonly: LogStoreTokenManagerContract[];
	private readonly logger: Logger;

	constructor(
		@inject(ContractFactory)
		contractFactory: ContractFactory,
		@inject(LoggerFactoryInjectionToken)
		loggerFactory: LoggerFactory,
		@inject(AuthenticationInjectionToken)
		authentication: Authentication,
		@inject(LogStoreClientConfigInjectionToken)
		logStoreClientConfig: Pick<StrictLogStoreClientConfig, 'contracts'>,
		@inject(StreamrClientConfigInjectionToken)
		streamrClientConfig: Pick<StrictStreamrClientConfig, 'contracts'>
	) {
		this.contractFactory = contractFactory;
		this.logStoreClientConfig = logStoreClientConfig;
		this.streamrClientConfig = streamrClientConfig;
		this.logger = loggerFactory.createLogger(module);
		this.authentication = authentication;
		this.logstoreTokenManagerContractsReadonly =
			getStreamRegistryChainProviders(this.streamrClientConfig).map(
				(provider: Provider) => {
					this.logger.debug('provider: ' + provider);
					const tokenManagerAddress = toEthereumAddress(
						this.logStoreClientConfig.contracts.logStoreTokenManagerChainAddress
					);
					this.logger.debug('tokenManagerAddress: ' + tokenManagerAddress);
					return this.contractFactory.createReadContract(
						tokenManagerAddress,
						LogStoreTokenManagerAbi,
						provider,
						'logStoreTokenManager'
					) as LogStoreTokenManagerContract;
				}
			);
	}

	private async connectToContract(): Promise<void> {
		if (!this.logStoreTokenManagerContract) {
			const chainSigner =
				await this.authentication.getStreamRegistryChainSigner();
			this.logStoreTokenManagerContract =
				this.contractFactory.createWriteContract<LogStoreTokenManagerContract>(
					toEthereumAddress(
						this.logStoreClientConfig.contracts.logStoreTokenManagerChainAddress
					),
					LogStoreTokenManagerAbi,
					chainSigner,
					'LSAN'
				);
		}
	}

	public async getBalance(): Promise<bigint> {
		return queryAllReadonlyContracts(async (contract) => {
			const accountAddress = await this.authentication.getAddress();
			this.logger.debug(`getBalance of current account: ${accountAddress}`);
			const balance = await contract
				.balanceOf(accountAddress)
				.then((b) => b.toBigInt());
			this.logger.debug(`got balance of ${accountAddress}: ${balance}`);
			return balance;
		}, this.logstoreTokenManagerContractsReadonly);
	}

	public async getPrice(): Promise<bigint> {
		return queryAllReadonlyContracts(async (contract) => {
			this.logger.debug('getPrice');
			const priceBN = await contract.price();
			return priceBN.toBigInt();
		}, this.logstoreTokenManagerContractsReadonly);
	}

	public async mint(
		amount: BigNumberish,
		overrides?: Overrides
	): Promise<ContractTransaction> {
		this.logger.debug('mint amount: ' + amount);
		await this.connectToContract();
		return this.logStoreTokenManagerContract!.mint({
			value: amount,
			...overrides,
		});
	}

	/**
	 * Helper to get correct amount of tokens in desired currency
	 */
	public async convert({
		to,
		amount,
		from,
	}: {
		amount: string;
		from: AmountTypes;
		to: AmountTypes;
	}): Promise<string> {
		this.logger.debug(`convert amount ${amount} from ${from} to ${to}`);

		const getWeiPerUsd = async () => {
			const usdPerMatic = await getMaticPrice(new Date().getTime());
			const usdPerWei = new Decimal(usdPerMatic).mul('1e-18');
			return usdPerWei.pow(-1);
		};

		const getWeiPerByte = async () => {
			const weiPerByte = await queryAllReadonlyContracts((contract) => {
				return contract.price();
			}, this.logstoreTokenManagerContractsReadonly);
			return new Decimal(weiPerByte.toString());
		};

		const getRatesToWei = {
			wei: () => new Decimal(1),
			usd: getWeiPerUsd,
			bytes: getWeiPerByte,
		};

		const outputDecimals = {
			wei: 0,
			usd: 18,
			bytes: 0,
		};

		const result = new Decimal(amount.toString())
			.mul(await getRatesToWei[from]())
			.div(await getRatesToWei[to]())
			.toDP(outputDecimals[to], Decimal.ROUND_DOWN);

		return result.toString();
	}
}
