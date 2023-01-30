import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import type { LogStore } from '../types/LogStore';

type Fixture<T> = () => Promise<T>;

declare module 'mocha' {
	export interface Context {
		logstore: LogStore;
		loadFixture: <T>(fixture: Fixture<T>) => Promise<T>;
		signers: Signers;
	}
}

export interface Signers {
	admin: SignerWithAddress;
}
