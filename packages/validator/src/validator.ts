import { Validator as KyveValidator } from '@kyvejs/protocol';
import { runCache as runKyveCache } from '@kyvejs/protocol/dist/src/methods';

import { IRuntimeExtended } from './types';

export async function runCache(this: Validator): Promise<void> {
	if (this.runtime.setupThreads) {
		this.runtime.setupThreads(this, this.home);
	}

	await runKyveCache.call(this);
	this.logger.debug('Cache output:', this.home);
}

export default class Validator extends KyveValidator {
	protected runtime!: IRuntimeExtended;
	protected override runCache = runCache;
}
