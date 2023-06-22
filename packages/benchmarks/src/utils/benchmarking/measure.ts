import Bench, { TaskResult } from 'tinybench';

import { sleep } from '../utils';

/**
 * Abstract benchmark handling of cold and hot tasks, and measuring their execution
 * @param benchs
 * We split hot and cold benches instead of using builtin warmup so we can keep stats of cold bench
 */
export const measure =
	(benchs: { hot: Bench; cold: Bench }) =>
	({
		name,
		delayBetweenCycles = 0,
	}: {
		name: string;
		/// in milliseconds
		delayBetweenCycles?: number;
	}) =>
	async (fn: () => Promise<any> | any): Promise<TaskResult | undefined> => {
		const coldTaskName = name + ' (cold)';

		const hooks: Parameters<Bench['add']>[2] = {
			afterEach: async () => {
				await sleep(delayBetweenCycles);
			},
		};

		const taskCold = benchs.cold
			.add(coldTaskName, fn, hooks)
			.getTask(coldTaskName)!;

		const hotTaskName = name + ' (hot)';
		const taskHot = benchs.hot
			.add(hotTaskName, fn, hooks)
			.getTask(hotTaskName)!;

		await taskCold.run();
		await taskHot.run();

		return taskHot.result;
	};
