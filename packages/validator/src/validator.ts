import {
	callWithBackoffStrategy,
	Validator as KyveValidator,
	standardizeJSON,
} from '@kyvejs/protocol';
import { validateDataAvailability as runKyveValidateDataAvailability } from '@kyvejs/protocol/dist/src/methods';

import { IRuntimeExtended } from './types';

// Hook into this method
export async function validateDataAvailability(this: Validator): Promise<void> {
	this.logger.debug('Home Directory:', this.home);
	if (this.runtime.setupThreads) {
		// * We cannot `await setupThreads` here because we need it to run async alongside other threads (ie. Kyve's `runCache` and `runNode`)
		this.runtime.setupThreads(this, this.home);
	}

	// ? Here we call the validateDataAvailability in a backoff strategy so that it's retried over time -- AFTER the Listener and Time Cache have started
	await callWithBackoffStrategy(
		async () => {
			await runKyveValidateDataAvailability.call(this);
		},
		{ limitTimeoutMs: 5 * 60 * 1000, increaseByMs: 10 * 1000 },
		async (err: any, ctx) => {
			this.logger.info(
				`validateDataAvailability was unsuccessful. Retrying in ${(
					ctx.nextTimeoutInMs / 1000
				).toFixed(2)}s ...`
			);
			this.logger.debug(standardizeJSON(err));
		}
	);
}
export default class Validator extends KyveValidator {
	protected runtime!: IRuntimeExtended;
	protected override validateDataAvailability = validateDataAvailability;
}
