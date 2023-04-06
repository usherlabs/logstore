import { Validator as KyveValidator } from '@kyvejs/protocol';
import {
	runCache as runKyveCache,
	syncPoolConfig as syncKyvePoolConfig,
} from '@kyvejs/protocol/src/methods';

import Listener from './listener';
import { PoolConfig } from './types';

export async function runCache(this: Validator): Promise<void> {
	this.logger.debug('Start listener: ', this.home);

	this.listener = new Listener(this, this.home);

	// eslint-disable-next-line
	this.listener.start();

	await runKyveCache.call(this);
	this.logger.debug('Cache output:', this.home);
}

export async function syncPoolConfig(this: Validator): Promise<void> {
	await syncKyvePoolConfig.call(this);
	// this.logger.debug(`Pool config:`, this.poolConfig);
	// Set the System Streams using the Smart Contract address
	const { contracts } = this.poolConfig as PoolConfig;
	this.systemStreamId = `${contracts.nodeManager.address}/system`;
}

export default class Validator extends KyveValidator {
	public listener: Listener;

	public systemStreamId: string;

	protected override runCache = runCache;
	protected override syncPoolConfig = syncPoolConfig;
}
