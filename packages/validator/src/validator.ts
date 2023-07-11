import { Validator as KyveValidator, sleep } from '@kyvejs/protocol';
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

	const listenerHasValidData = async () => {
		const getCurrentKeyMs = async () => {
			/* eslint-disable */
			const nextKey = this.pool.data!.current_key
				? await this.runtime.nextKey(this, this.pool.data!.current_key)
				: this.pool.data!.start_key;
			/* eslint-enable */

			return parseInt(nextKey, 10) * 1000;
		};

		let currentKeyMs = await getCurrentKeyMs();
		while (
			!this.runtime.listener.startTime ||
			this.runtime.listener.startTime > currentKeyMs
		) {
			if (!this.runtime.listener.startTime) {
				this.logger.info(
					'SystemListener is not started yet. Sleeping for 10 seconds...'
				);
				await sleep(10 * 1000);
			} else {
				const sleepMs = this.runtime.listener.startTime - currentKeyMs + 1000;
				this.logger.info(
					`SystemListener.startTime (${
						this.runtime.listener.startTime
					}) is greater than currentKeyMs (${currentKeyMs}). Sleeping for ${(
						sleepMs / 1000
					).toFixed(2)} seconds...`
				);
				await sleep(sleepMs);
			}
			await this.syncPoolState();
			currentKeyMs = await getCurrentKeyMs();
		}
	};

	await Promise.all([this.runtime.time.ready(), listenerHasValidData()]);

	// Is there still a reason to call validateDataAvailability?
	// It has a try-catch block that calls process.exit(1) when catches an error.
	// Wrapping wiht callWithBackoffStrategy won't help here.
	await runKyveValidateDataAvailability.call(this);
}

KyveValidator.storageProviderFactory = storageProviderFactory;

export default class Validator extends KyveValidator {
	protected runtime!: IRuntimeExtended;
	protected override validateDataAvailability = validateDataAvailability;
}
