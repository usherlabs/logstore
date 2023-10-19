import { transactionSplitProtocol } from '../src/utils/storage/transactionSplit';

describe('Transaction split protocol', () => {
	it('isSplit true works', () => {
		const goodStorageIds = [
			'v0_ewoijqomoi123iewoewkw',
			'v0_ewokqewpew+eww11_we',
			'v0_19023jk291021',
		];

		for (const txId of goodStorageIds) {
			const res = transactionSplitProtocol.isSplit(txId);
			expect(res).toBe(true);
		}
	});

	it('isSplit false works', () => {
		const badStorageIds = [
			'v99_ewoijqomoi123iewoewkw', // inexistent version
			'v0-ewokqewpew+eww11_we', // invalid separator
			'x9_19023jk291021', // invalid version
			{ a: 'b' }, // invalid type
		];

		for (const txId of badStorageIds) {
			const res = transactionSplitProtocol.isSplit(txId as any);
			expect(res).toBe(false);
		}
	});

	describe('v0', () => {
		it('encode & decode works', () => {
			const txIds = [
				'ewoijqomoi123iewoewkw',
				'ewokqewpew+eww11_we',
				'19023jk291021',
			];

			const storageId = transactionSplitProtocol.getStorageId(txIds);
			expect(storageId).toMatchInlineSnapshot(
				`"v0_ZXdvaWpxb21vaTEyM2lld29ld2t3LGV3b2txZXdwZXcrZXd3MTFfd2UsMTkwMjNqazI5MTAyMQ=="`
			);
			const decodedTxIds =
				transactionSplitProtocol.getTransactionIds(storageId);

			expect(decodedTxIds).toEqual(txIds);
		});

		it('no txIds throws', () => {
			expect(() => transactionSplitProtocol.getStorageId([])).toThrow();
		});

		it('1 txId works too', () => {
			const txIds = ['ewoijqomoi123iewoewkw'];
			const storageId = transactionSplitProtocol.getStorageId(txIds);
			expect(storageId).toMatchInlineSnapshot(
				`"v0_ZXdvaWpxb21vaTEyM2lld29ld2t3"`
			);
			const decodedTxIds =
				transactionSplitProtocol.getTransactionIds(storageId);

			expect(decodedTxIds).toEqual(txIds);
		});
	});
});
