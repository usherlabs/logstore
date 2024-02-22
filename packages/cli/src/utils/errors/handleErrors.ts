import { handleKnownTxError, isTxError } from '@/utils/errors/txErrors';
import {
	handleKnownGeneralError,
	isErrorWithReasonObject,
} from '@/utils/errors/generalErrors';
import { logger } from '@/utils/utils';

export const handleKnownError = async (err: unknown) => {
	try {
		switch (true) {
			case isTxError(err):
				await handleKnownTxError(err);
				break;
			case isErrorWithReasonObject(err):
				await handleKnownGeneralError(err);
				break;
			default:
				logger.error(err);
		}
	} catch (e) {
		logger.debug('Could not handle error.');
		logger.debug(e);
		// Ignore here. This solution to log help messages should not be robust.
	}
};
