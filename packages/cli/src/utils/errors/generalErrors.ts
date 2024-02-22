import { and, getErrorType, or } from '@/utils/errors/compose';
import chalk from 'chalk';
import { logger } from '@/utils/utils';
import type { Transaction } from 'ethers';

/**
 * Known general errors
 *
 * These are errors that are probably not of an instance type, or maybe multiple.
 * Ideally, we could have a more specific error type out of these, but for now, we'll just handle them here.
 */
enum KnownGeneralErrors {
	NO_NETWORK = 'NO_NETWORK',
}

type ReasonObject = {
	reason: string;
	code: string;
	event: string;
};
type TransactionError = ReasonObject & {
	transaction: Transaction;
	error: Error; // Request error more specifically
};

/**
 * Error with reason object. It's a bit generic, but at least keeps out of a full dark any.
 * It was generated from runtime experience.
 */
type ErrorWithReason = Error &
	(
		| {
				reason: ReasonObject;
		  }
		| TransactionError
	);

/**
 * Type guard for ErrorWithReason
 */
export const isErrorWithReasonObject = (
	err: unknown
): err is ErrorWithReason => {
	const containsReason =
		typeof err === 'object' &&
		err !== null &&
		'reason' in (err as ErrorWithReason);

	return containsReason;
};

/**
 * Known general error filters. These are the filters that will be used to map an error to a known general error type.
 */
const knownGeneralErrorFilters = {
	[KnownGeneralErrors.NO_NETWORK]: or(
		// (err: ErrorWithReason) => err.reason.code === 'NETWORK_ERROR',
		(err: ErrorWithReason) =>
			'code' in err
				? err.code === 'NETWORK_ERROR'
				: err.reason.code === 'NETWORK_ERROR',
		and((err: ErrorWithReason) =>
			err.message.includes('missing revert data in call exception')
		)
	),
} satisfies Record<KnownGeneralErrors, unknown>;

/**
 * Handles known general errors, logging if necessary with appropriate messages.
 * As these errors handling are not robust, it's better to maintain a suggestion tone.
 * @param err
 */
export const handleKnownGeneralError = async (err: ErrorWithReason) => {
	const errorType = await getErrorType(knownGeneralErrorFilters, err);
	if (errorType) {
		switch (errorType) {
			case KnownGeneralErrors.NO_NETWORK:
				logger.error(
					chalk.yellow(
						'Please check if your RPC URL is correct and the network is available'
					)
				);
				break;
		}
	}
};
