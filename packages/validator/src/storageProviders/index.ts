import { IStorageProvider } from '@kyvejs/protocol';

import { Arweave } from './Arweave';

export const storageProviderFactory = (
	_storageProviderId: number,
	storagePriv: string
): IStorageProvider => {
	return new Arweave(storagePriv);
};
