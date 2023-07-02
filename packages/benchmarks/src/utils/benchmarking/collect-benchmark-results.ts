import Bench from 'tinybench';

import { RawResultRecord } from './result-types';

/**
 * Collect benchmark results from a bench
 *
 * it also order the tasks by name
 * @param bench
 */
export const collectBenchmarkResults = (bench: Bench): RawResultRecord => {
	const { tasks } = bench;
	return tasks.reduce((acc, r) => {
		const { samples, ...rest } = r.result ?? {};
		const stats = { ...rest, population: samples?.length ?? 0 };
		return {
			...acc,
			[r.name]: {
				date: new Date().toISOString(),
				stats: stats,
			},
		};
	}, {} as RawResultRecord);
};
