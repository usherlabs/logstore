import type { PoolConfig } from '../types';
import Validator from '../validator';

export const getConfig = (core: Validator): PoolConfig => {
	return {
		itemTimeRange: 1000,
		...core.poolConfig,
		fees: {
			writeMultiplier: 1,
			treasuryMultiplier: 0.2,
			read: 0.00000001, // value in USD
			...(core.poolConfig.fees || {}),
		},
	};
};
