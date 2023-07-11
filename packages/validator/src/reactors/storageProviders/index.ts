import { IStorageProvider } from '@kyvejs/protocol';

import { ArweaveSplit } from './ArweaveSplit';

export const storageProviderFactory = (
	_storageProviderId: number,
	storagePriv: string
): IStorageProvider => {
	return new ArweaveSplit(storagePriv);
};
