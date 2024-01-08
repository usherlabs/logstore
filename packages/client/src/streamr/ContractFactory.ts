import { Signer } from '@ethersproject/abstract-signer';
import { Contract, ContractInterface } from '@ethersproject/contracts';
import { Provider } from '@ethersproject/providers';
import { EthereumAddress } from '@streamr/utils';

import { ObservableContract } from './utils/contract';

export interface ContractFactory {
	createReadContract<T extends Contract>(
		address: EthereumAddress,
		contractInterface: ContractInterface,
		provider: Provider,
		name: string
	): ObservableContract<T>;

	createWriteContract<T extends Contract>(
		address: EthereumAddress,
		contractInterface: ContractInterface,
		signer: Signer,
		name: string
	): ObservableContract<T>;
}

export const ContractFactoryInjectionToken = Symbol('ContractFactory');
