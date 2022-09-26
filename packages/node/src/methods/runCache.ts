import { ERROR_IDLE_TIME, sleep } from '@kyve/core';

import { SupportedSources } from '@/types';
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
			await this.cache.drop(+this.pool.data!.current_height);
			this.prom.cache_current_items.set(+this.pool.data!.current_height);
			this.logger.debug(`Reset source cache values to current height`);
			await Promise.all(
				Object.entries(SupportedSources).map(([, sourceName]) => {
					return this.sourceCache[sourceName].reset(
						+this.pool.data!.current_height
					);
				})
			);
			this.logger.info(`Cleared cache\n`);
		}

		// setup pipelines
		await this.setupPipelines();

		// cache data items from current height to required height
		createdAt = +this.pool.bundle_proposal!.created_at;
		currentHeight = +this.pool.data!.current_height;
		toHeight =
			+this.pool.bundle_proposal!.to_height || +this.pool.data!.current_height;
		// Max height should consider the responses from pipeline transformers
		maxHeight =
			+this.pool.data!.max_bundle_size - this.pipelines.length + toHeight;

		this.prom.cache_height_tail.set(currentHeight);

		let startHeight: number;
		let key: string;

		// determine from which height to continue caching
		if (await this.cache.exists((toHeight - 1).toString())) {
			startHeight = toHeight;
			key = this.pool.bundle_proposal!.to_key;
		} else {
			startHeight = currentHeight;
			key = this.pool.data!.current_key;
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
					nextKey = this.pool.data!.start_key;
				}

				const item = await this.runtime.getDataItem(this, nextKey);
				this.prom.runtime_get_data_item_successful.inc();

				if (item.key) {
					await this.cache.put(height.toString(), item);
					this.prom.cache_current_items.inc();
					this.prom.cache_height_head.set(height);
					await sleep(50);
				}

				// TODO: Solve for this -- data is going to be stored such that keys are going to be skipped
				// ? The reason for this -- the Node is constantly producing bundles using a height range
				// ? Also, idleing here would pause the interval, preventing transformation functions from executing.
				// Heights are still required here to ensure that cache is cleared for dropped/invalid bundles.
				key = nextKey;
				height += 1;
			} catch {
				this.logger.warn(`Failed to get data item from height ${height}`);
				this.prom.runtime_get_data_item_failed.inc();

				await sleep(ERROR_IDLE_TIME);
			}
		}

		// After bundling -- We need expose the Storage Layer to the Transformers.
		for (let i = 0; i < this.pipelines.length; i += 1) {
			const pipeline = this.pipelines[i];
			// Create a version of the Storage Layer this.cache that is read only, and isolated to given pipeline that the Transformer belongs to.
			const instance = await this.cache.isolate(pipeline.id);

			let transformation = {};
			if (pipeline.transformer) {
				transformation = await pipeline.transformer(instance);
			}
			await this.cache.put(height.toString(), {
				type: 'transform',
				pipeline: pipeline.id,
				out: transformation,
			});
			this.prom.cache_current_items.inc();
			this.prom.cache_height_head.set(height);

			height += 1;
		}

		// wait until new bundle proposal gets created
		while (createdAt === +this.pool.bundle_proposal!.created_at) {
			await sleep(1000);
		}
	}
}
