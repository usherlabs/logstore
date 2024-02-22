import { type BigNumber, ethers, type Wallet } from 'ethers';
import chalk from 'chalk';
import {
	combineLatest,
	defaultIfEmpty,
	filter,
	firstValueFrom,
	from,
	map,
	of,
} from 'rxjs';
import {
	and,
	type ErrorFilters,
	getErrorType,
	or,
} from '@/utils/errors/compose';
import { getCredentialsFromOptions } from '@/utils/logstore-client';
import { logger } from '@/utils/utils';

// ----- These types were generated from runtime experience -----
export interface txItem {
	gasLimit?: BigNumber;
	data: string;
	chainId: chainIdItem;
	maxPriorityFeePerGas?: BigNumber;
	from: string;
	to: unknown;
	maxFeePerGas?: BigNumber;
	type: number;
	nonce: BigNumber;
}

export interface chainIdItem {}

export interface TransactionError {
	reason: string;
	code: string;
	method: string;
	error: TransactionError;
	transaction: transactionItem;
}

export interface transactionItem {
	data: string;
	accessList: unknown;
	maxPriorityFeePerGas?: BigNumber;
	from: string;
	to: unknown;
	maxFeePerGas?: BigNumber;
	type: number;
}

export interface TxError {
	reason: string;
	code: string;
	tx: txItem;
	error: TransactionError;
}

enum KnownTxErrors {
	INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
}

const maxFeePerGasFromCtx = (err: TxError) =>
	of(err.tx.maxFeePerGas).pipe(filter(Boolean), map(ethers.BigNumber.from));

const balanceFromWallet = (wallet: Wallet) =>
	from(wallet.getBalance()).pipe(map(ethers.BigNumber.from));

/**
 * Known transaction error filters. These are the filters that will be used to map an error to a known transaction error type.
 * As these errors handling are not robust, it's better to maintain a suggestion tone.
 * */
const knownTxErrorFilters = {
	[KnownTxErrors.INSUFFICIENT_FUNDS]: or<TxError>(
		// this is expected to usually happen
		(err) => err.code === 'INSUFFICIENT_FUNDS',

		and(
			// for some reason, some providers are returning this error instead
			(err) => err.code === 'UNPREDICTABLE_GAS_LIMIT',
			// but we are also checking if the balance is insufficient
			(err) => {
				const { signer } = getCredentialsFromOptions();
				const maxFeePerGas$ = maxFeePerGasFromCtx(err);
				const walletBalance$ = balanceFromWallet(signer);

				const isBalanceInsufficient$ = combineLatest({
					maxFeePerGas: maxFeePerGas$,
					walletBalance: walletBalance$,
				}).pipe(
					map(
						({ maxFeePerGas, walletBalance }) => maxFeePerGas > walletBalance
					),
					defaultIfEmpty(false)
				);
				return firstValueFrom(isBalanceInsufficient$);
			}
		)
	),
} as const satisfies ErrorFilters<KnownTxErrors, TxError>;

export const isTxError = (e: unknown): e is TxError => {
	return (
		(e as TxError).tx !== undefined &&
		(e as TxError).reason !== undefined &&
		(e as TxError).code !== undefined
	);
};

export const handleKnownTxError = async (err: TxError) => {
	const type = await getErrorType(knownTxErrorFilters, err);
	switch (type) {
		case KnownTxErrors.INSUFFICIENT_FUNDS:
			logger.error(
				chalk.yellow(
					'Please check if you have enough funds to cover the transaction fee.'
				)
			);
			break;
		default:
			break;
	}
};
