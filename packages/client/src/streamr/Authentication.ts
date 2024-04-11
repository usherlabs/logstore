import { EthereumAddress } from '@streamr/sdk';
import { Signer } from 'ethers';

export interface Authentication {
	getAddress: () => Promise<EthereumAddress>;
	createMessageSignature: (payload: Uint8Array) => Promise<Uint8Array>;
	getStreamRegistryChainSigner: () => Promise<Signer>;
}

export const AuthenticationInjectionToken = Symbol('Authentication');
