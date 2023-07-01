import { Validator as KyveValidator } from '@kyvejs/protocol';
import { validateDataAvailability as runKyveValidateDataAvailability } from '@kyvejs/protocol/dist/src/methods';

import { storageProviderFactory } from './storageProviders';
import { IRuntimeExtended } from './types';
import { Slogger } from './utils/slogger';

// Hook into this method
export async function validateDataAvailability(this: Validator): Promise<void> {
	Slogger.register(this.logger);
	this.logger.debug('Home Directory:', this.home);
	if (this.runtime.setupThreads) {
		// * We cannot `await setupThreads` here because we need it to run async alongside other threads (ie. Kyve's `runCache` and `runNode`)
		this.runtime.setupThreads(this, this.home);
	}

	await this.runtime.time.ready();
	await runKyveValidateDataAvailability.call(this);
}

KyveValidator.storageProviderFactory = storageProviderFactory;

export default class Validator extends KyveValidator {
	protected runtime!: IRuntimeExtended;
	protected override validateDataAvailability = validateDataAvailability;
}
