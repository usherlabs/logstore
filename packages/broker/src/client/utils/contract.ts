import { ContractReceipt, ContractTransaction } from '@ethersproject/contracts';
import { shuffle } from 'lodash';

import { tryInSequence } from './promises';

export async function waitForTx(
	txToSubmit: Promise<ContractTransaction>
): Promise<ContractReceipt> {
	const tx = await txToSubmit;
	return tx.wait();
}

export const queryAllReadonlyContracts = <T, C>(
	call: (contract: C) => Promise<T>,
	contracts: C[]
): Promise<T> => {
	return tryInSequence(
		shuffle(contracts).map((contract: C) => {
			return () => call(contract);
		})
	);
};
