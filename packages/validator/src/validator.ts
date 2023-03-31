import { IRuntime, Validator as KyveValidator } from '@kyvejs/protocol';
import {
	runCache as runKyveCache,
	syncPoolConfig as syncKyvePoolConfig,
} from '@kyvejs/protocol/src/methods';

import Listener from './listener';
import { PoolConfig } from './types';

export async function runCache(this: Validator): Promise<void> {
	await runKyveCache.bind(this);
	await this.listener.start(this.home); // hook into the start process
}

export async function syncPoolConfig(this: Validator): Promise<void> {
	await syncKyvePoolConfig.bind(this);
	// Set the System Streams using the Smart Contract address
	const { contracts } = this.poolConfig as PoolConfig;
	console.log(this.poolConfig);
	this.systemStreamId = `${contracts.storeManager.address}/logstore-system`;
	this.queryStreamId = `${contracts.storeManager.address}/logstore-query`;
}

export default class Validator extends KyveValidator {
	public listener: Listener;

	public systemStreamId: string;
	public queryStreamId: string;

	protected override runCache = runCache;
	protected override syncPoolConfig = syncPoolConfig;

	/**
	 * Constructor for the validator class. It is required to provide the
	 * runtime class here in order to run the
	 *
	 * @method constructor
	 * @param {IRuntime} runtime which implements the interface IRuntime
	 */
	constructor(runtime: IRuntime) {
		super(runtime);

		this.listener = new Listener(this);
	}
}
