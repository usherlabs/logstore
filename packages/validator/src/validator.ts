import { Validator as KyveValidator } from '@kyvejs/protocol';
import { validateDataAvailability as runKyveValidateDataAvailability } from '@kyvejs/protocol/dist/src/methods';

import { IRuntimeExtended } from './types';

// Hook into this method
export async function validateDataAvailability(this: Validator): Promise<void> {
	if (this.runtime.setupThreads) {
		await this.runtime.setupThreads(this, this.home);
	}

	await runKyveValidateDataAvailability.call(this);
	this.logger.debug('Home Directory:', this.home);
}
export default class Validator extends KyveValidator {
	protected runtime!: IRuntimeExtended;
	protected override validateDataAvailability = validateDataAvailability;
}
