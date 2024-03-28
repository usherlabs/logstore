import { EthereumAddress } from '@streamr/sdk';
import { Signer } from 'ethers';

export interface Authentication {
	getAddress: () => Promise<EthereumAddress>;
	createMessageSignature: (payload: string) => Promise<string>;
	getStreamRegistryChainSigner: () => Promise<Signer>;
}

export const AuthenticationInjectionToken = Symbol('Authentication');
