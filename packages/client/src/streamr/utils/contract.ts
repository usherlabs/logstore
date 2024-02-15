import {
	Contract,
	ContractReceipt,
	ContractTransaction,
} from '@ethersproject/contracts';
import EventEmitter from 'eventemitter3';
import shuffle from 'lodash/shuffle';

import { tryInSequence } from '../../utils/promises';

export interface ContractEvent {
	onMethodExecute: (methodName: string) => void;
	onTransactionSubmit: (methodName: string, tx: ContractTransaction) => void;
	onTransactionConfirm: (
		methodName: string,
		tx: ContractTransaction,
		receipt: ContractReceipt
	) => void;
}

export type ObservableContract<T extends Contract> = T & {
	eventEmitter: EventEmitter<ContractEvent>;
};

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
