import { logger, replaceTransaction } from '@/utils/utils';
import { createPrompt, isEnterKey, useKeypress } from '@inquirer/prompts';
import chalk from 'chalk';
import Decimal from 'decimal.js';
import {
	type ContractReceipt,
	type ContractTransaction,
	ethers,
	type Signer,
	type Transaction,
} from 'ethers';
import {
	BehaviorSubject,
	catchError,
	defer,
	delayWhen,
	EMPTY,
	first,
	merge,
	mergeMap,
	Observable,
	type ObservableInput,
	of,
	retry,
	throwError,
} from 'rxjs';

const createTransactionWithIncreasedTip = <T extends Transaction>(
	signer: Signer,
	tx: T,
	/// 1.1 = 110%
	percentage: number
) => {
	const maxPriorityFeePerGas = new Decimal(
		tx.maxPriorityFeePerGas?.toHexString() ?? '0x0'
	);
	const maxPriorityFeePerGasIncreased = maxPriorityFeePerGas
		.mul(percentage)
		.round()
		.toHex();

	return replaceTransaction(signer, tx, {
		maxFeePerGas: undefined,
		gasPrice: undefined,
		maxPriorityFeePerGas: maxPriorityFeePerGasIncreased,
	});
};

const errorIncludesMessages = (acceptedMessages: string[]) => (e: any) =>
	acceptedMessages.some((msg) => e.message.includes(msg));

// const skipErrorMessagesContaining =
// 	(acceptedMessages: string[]) => (e: any) => {
// 		console.log('got error: ', e.message);
// 		// if contains 'nonce has already been used'
// 		// then we just return empty stream
// 		if (errorIncludesMessages(acceptedMessages)(e)) {
// 			return EMPTY;
// 		} else {
// 			return throwError(() => e);
// 		}
// 	};

const handleError = (
	acceptedMessages: string[],
	errorHandler: (e: any) => ObservableInput<any>
) =>
	catchError((e: any): ObservableInput<any> => {
		if (acceptedMessages.some((msg) => e.message.includes(msg))) {
			return errorHandler(e);
		}
		return throwError(() => e);
	});

export const keepRetryingWithIncreasedGasPrice = (
	signer: Signer,
	currentTx: ContractTransaction
): Observable<ContractReceipt> => {
	const provider = signer.provider;
	if (!provider) {
		throw new Error('provider is required');
	}

	const lastCreatedTransaction$ = new BehaviorSubject<ContractTransaction>(
		currentTx
	);
	const retryCall = async (oldTransaction: ContractTransaction) => {
		const newTransaction = await createTransactionWithIncreasedTip(
			signer,
			oldTransaction,
			1.2
		);
		console.log('');
		console.log('Replacing transaction with increased gas price');
		console.log('New tx: ', chalk.underline(newTransaction.hash));
		console.log(
			'New maxPriorityFeePerGas: ',
			ethers.utils.formatUnits(
				newTransaction.maxPriorityFeePerGas ?? NaN,
				'gwei'
			),
			' gwei per gas'
		);
		lastCreatedTransaction$.next(newTransaction);
		return newTransaction;
	};

	const createTransactionOnEnter$ = lastCreatedTransaction$.pipe(
		delayWhen(() => userPressEnter$),
		mergeMap((tx) =>
			defer(() => retryCall(tx)).pipe(
				// we want to retry this call only if the error is one of the following.
				// we don't want to be asking again the user if he wants to increase the gas price
				// as he already mentioned it. that's why we make it here
				retry({
					delay: (error) => {
						logger.debug('retrying', error.message);
						return errorIncludesMessages([
							'replacement fee too low',
							'could not replace existing',
						])(error)
							? of(1)
							: EMPTY;
					},
				})
			)
		),
		// it seems it's already completed, we're safe to stop here
		handleError(['nonce has already been used'], () => EMPTY)
	);

	const acceptedTransaction$ = merge(
		createTransactionOnEnter$,
		of(currentTx)
	).pipe(
		mergeMap((tx) => tx.wait(1)),
		handleError(['transaction was replaced', 'repriced'], (e) => {
			return provider?.waitForTransaction(e.replacement.hash);
		}),
		first()
	);

	return acceptedTransaction$;
};
const userPressEnter$ = new Observable((subscriber) => {
	const prompt = confirm({
		message:
			'Press enter if you wish to raise the gas incentives to speedup the tx',
	});
	void prompt
		.catch(() => {
			// cancelled, just ignore
		})
		.then((result) => {
			subscriber.next(result);
			subscriber.complete();
		});
	return () => {
		prompt.cancel();
	};
});
const confirm = createPrompt<boolean, { message: string; default?: boolean }>(
	(config, done) => {
		useKeypress((key) => {
			if (isEnterKey(key)) {
				done(true);
			} else {
				// do nothing
			}
		});
		const message = chalk.bold(config.message);
		return message;
	}
);
