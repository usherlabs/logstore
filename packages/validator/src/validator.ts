import { IRuntime, Validator as KyveValidator } from '@kyvejs/protocol';
import { runCache as runKyveCache } from '@kyvejs/protocol/src/methods';

import Listener from './listener';

async function runCache(this: Validator): Promise<void> {
	runKyveCache.bind(this);
	await this.listener.start(this.home); // hook into the start process
}

export default class Validator extends KyveValidator {
	public listener: Listener;

	protected override runCache = runCache;

	/**
	 * Constructor for the validator class. It is required to provide the
	 * runtime class here in order to run the
	 *
	 * @method constructor
	 * @param {IRuntime} runtime which implements the interface IRuntime
	 */
	constructor(runtime: IRuntime, listener: Listener) {
		super(runtime);

		this.listener = listener;
	}
}
