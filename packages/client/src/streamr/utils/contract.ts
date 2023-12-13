import {
	Contract,
	ContractReceipt,
	ContractTransaction,
} from '@ethersproject/contracts';
import EventEmitter from 'eventemitter3';

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
