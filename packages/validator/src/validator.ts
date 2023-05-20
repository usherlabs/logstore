import { Validator as KyveValidator } from '@kyvejs/protocol';
import { runCache as runKyveCache } from '@kyvejs/protocol/dist/src/methods';

import Listener from './listener';

export async function runCache(this: Validator): Promise<void> {
	this.listener = new Listener(
		this.runtime.config.systemStreamId,
		this.home,
		this.logger
	);

	// eslint-disable-next-line
	this.listener.start();

	await runKyveCache.call(this);
	this.logger.debug('Cache output:', this.home);
}

export default class Validator extends KyveValidator {
	public listener: Listener;

	protected override runCache = runCache;
}
