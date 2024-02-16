import { Signer } from 'ethers';
import { EthereumAddress } from 'streamr-client';

export interface Authentication {
	getAddress: () => Promise<EthereumAddress>;
	createMessageSignature: (payload: string) => Promise<string>;
	getStreamRegistryChainSigner: () => Promise<Signer>;
}

export const AuthenticationInjectionToken = Symbol('Authentication');
