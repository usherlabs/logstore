// == AVAILABLE VERSIONS ==
import {
	StorageId_v0,
	transactionSplitUtilsV0,
	transactionSplitV0,
} from './transactionSplitV0';

type TransactionSplitVersion = 'v0';
const LATEST_VERSION = 'v0';

type StorageId = StorageId_v0; // future: add more versions

// == PROTOCOL ==

export type TransactionSplitProtocol = {
	validate: (storageId: string) => storageId is StorageId;
	encode: (transactionIds: string[]) => StorageId;
	decode: (transactionId: StorageId) => string[];
};

// == VERSION BASED DICTIONARIES ==

const validateVersionDict = {
	v0: transactionSplitV0.validate,
};

const encodeDict = {
	v0: transactionSplitV0.encode,
} satisfies {
	[key in TransactionSplitVersion]: (transactionIds: string[]) => StorageId;
};

const decodeDict = {
	v0: transactionSplitV0.decode,
} satisfies {
	[key in TransactionSplitVersion]: (rawStorageId: StorageId) => string[];
};

// == UTILS ==

const getStorageIdVersion = (rawStorageId: string): string => {
	return rawStorageId.split('_')[0];
};

// == USER FACING FUNCTIONS ==

const transactionSplitProtocol = {
	getStorageId: (
		transactionIds: string[],
		version: TransactionSplitVersion = LATEST_VERSION
	): StorageId => {
		return encodeDict[version](transactionIds);
	},
	getTransactionIds: (storageId: StorageId): string[] => {
		const version = getStorageIdVersion(storageId);
		return decodeDict[version](storageId);
	},
	// must be called before getTransactionIds, so we can know which version to use
	// and safe guard against invalid storageIds
	isSplit: (rawStorageId: string): rawStorageId is StorageId => {
		try {
			const version = getStorageIdVersion(rawStorageId);
			return validateVersionDict[version](rawStorageId);
		} catch (e) {
			return false;
		}
	},
};

export { transactionSplitProtocol, transactionSplitUtilsV0 };
