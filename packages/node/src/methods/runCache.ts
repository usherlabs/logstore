import { sleep } from '@kyve/core/dist/src/utils';

import type { Node } from '../node';

export async function runCache(this: Node): Promise<void> {
	let createdAt = 0;
	let currentHeight = 0;
	let toHeight = 0;
	let maxHeight = 0;

	while (true) {
		// a smaller to_height means a bundle got dropped or invalidated
		if (+this.pool.bundle_proposal!.to_height < toHeight) {
			this.logger.debug(`Attempting to clear cache`);
			await this.cache.drop(+this.pool.current_height);
			this.logger.info(`Cleared cache\n`);
		}

		// setup pipelines
		await this.setupPipelines();

		// cache data items from current height to required height
		createdAt = +this.pool.bundle_proposal!.created_at;
		currentHeight = +this.pool.current_height;
		toHeight =
			+this.pool.bundle_proposal!.to_height || +this.pool.current_height;
		// Max height should consider the responses from pipeline transformers
		maxHeight = +this.pool.max_bundle_size - this.pipelines.length + toHeight;

		let startHeight: number;
		let key: string;

		// determine from which height to continue caching
		if (await this.cache.exists((toHeight - 1).toString())) {
			startHeight = toHeight;
			key = this.pool.bundle_proposal!.to_key;
		} else {
			startHeight = currentHeight;
			key = this.pool.current_key;
		}

		this.logger.debug(`Caching from height ${startHeight} to ${maxHeight} ...`);

		let height = startHeight;

		// Bundle creation
		while (height < maxHeight) {
			try {
				let nextKey;

				if (key) {
					nextKey = await this.runtime.getNextKey(key);
				} else {
					nextKey = this.pool.start_key;
				}

				const item = await this.runtime.getDataItem(this, nextKey);

				await this.cache.put(height.toString(), item);
				await sleep(50);

				key = nextKey;
				height += 1;
			} catch {
				this.logger.warn(`Failed to get data item from height ${height}`);
				await sleep(10 * 1000);
			}
		}

		// After bundling -- We need expose the Storage Layer to the Transformers.
		for (let i = 0; i < this.pipelines.length; i += 1) {
			const pipeline = this.pipelines[i];
			// Create a version of the Storage Layer this.cache that is read only, and isolated to given pipeline that the Transformer belongs to.
			const instance = this.cache.isolate(pipeline.id);

			let transformation = {};
			if (pipeline.transformer) {
				transformation = await pipeline.transformer(instance);
			}
			await this.cache.put(height.toString(), {
				type: 'transform',
				pipeline: pipeline.id,
				out: transformation,
			});
			height += 1;
		}

		// wait until new bundle proposal gets created
		while (createdAt === +this.pool.bundle_proposal!.created_at) {
			await sleep(1000);
		}
	}
}
