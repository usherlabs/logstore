import { Validator as KyveValidator } from '@kyvejs/protocol';
import { validateDataAvailability as runKyveValidateDataAvailability } from '@kyvejs/protocol/dist/src/methods';

import { compressionFactory } from './reactors/compression';
import { storageProviderFactory } from './reactors/storageProviders';
import { IRuntimeExtended } from './types';
import { Slogger } from './utils/slogger';

// Hook into this method
export async function validateDataAvailability(this: Validator): Promise<void> {
	Slogger.register(this.logger);
	this.logger.debug('Home Directory:', this.home);

	if (this.runtime.setup) {
		await this.runtime.setup(this, this.home);
	}
	if (this.runtime.runThreads) {
		// * We cannot `await setupThreads` here because we need it to run async alongside other threads (ie. Kyve's `runCache` and `runNode`)
		this.runtime.runThreads(this);
	}
	if (this.runtime.ready) {
		await this.runtime.ready(this, () => this.syncPoolState());
	}

	// Is there still a reason to call validateDataAvailability?
	// It has a try-catch block that calls process.exit(1) when catches an error.
	// Wrapping wiht callWithBackoffStrategy won't help here.
	// ? It's an additional layer of validation - ie. where current_key is set, it can prevent networking issues from causing slashes.
	await runKyveValidateDataAvailability.call(this);
}

KyveValidator.storageProviderFactory = storageProviderFactory;
KyveValidator.compressionFactory = compressionFactory;

export default class Validator extends KyveValidator {
	protected runtime!: IRuntimeExtended;
	protected override validateDataAvailability = validateDataAvailability;
}
