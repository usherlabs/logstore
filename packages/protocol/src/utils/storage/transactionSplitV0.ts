import type { TransactionSplitProtocol } from './transactionSplit';

export type StorageId_v0 = string & { __storageId_v0: never }; // branded

export const transactionSplitV0 = {
	validate: (storageId: string): storageId is StorageId_v0 => {
		return storageId.startsWith('v0_');
	},
	encode: (transactionIds: string[]): StorageId_v0 => {
		const prefix = `v0_`;
		return (prefix +
			Buffer.from(transactionIds.join(','), 'utf8').toString(
				'base64'
			)) as StorageId_v0;
	},
	decode: (rawStorageId: StorageId_v0): string[] => {
		const encodedId = rawStorageId.substring(3, rawStorageId.length);
		return Buffer.from(encodedId, 'base64').toString('utf8').split(',');
	},
} satisfies TransactionSplitProtocol;

const getEventsTransactionsFromTransactionsV0 = (
	transactionIds: string[]
): string | undefined => {
	// we know that events is not required on a bundle
	return transactionIds.length > 2 ? transactionIds.at(-2) : undefined;
};

export const transactionSplitUtilsV0 = {
	getEventsTransactions: getEventsTransactionsFromTransactionsV0,
};
