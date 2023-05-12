import { Validator as KyveValidator } from '@kyvejs/protocol';
import {
	runCache as runKyveCache,
	syncPoolConfig as syncKyvePoolConfig,
} from '@kyvejs/protocol/src/methods';
import redstone from 'redstone-api';

import Listener from './listener';

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
	this.logger.debug(`Pool config:`, this.poolConfig);
	// Set the System Streams using the Smart Contract address
	const { contracts } = this.poolConfig;
	this.systemStreamId = `${contracts.nodeManagerAddress}/system`;
}

/**
 * getTokenPrice wraps the request to an Oracle network to fetch a token's price.
 * It will always use Redstone Price Oracles outside of tests.
 * It is mocked in unit tests to return a constant where non-indexed Developer Tokens are used.
 */
export async function getTokenPrice(
	this: Validator,
	tokenSymbol: string
): Promise<number> {
	const resp = await redstone.getPrice(tokenSymbol, {
		verifySignature: true,
	});
	return resp.value;
}

export default class Validator extends KyveValidator {
	public listener: Listener;

	public systemStreamId: string;

	protected override runCache = runCache;
	protected override syncPoolConfig = syncPoolConfig;

	public getTokenPrice = getTokenPrice;
}
