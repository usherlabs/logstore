import type { PoolConfig } from '../types';
import Validator from '../validator';

export const getConfig = (core: Validator): PoolConfig => {
	return {
		itemTimeRange: 1000,
		...core.poolConfig,
		fees: {
			writeMultiplier: 1,
			treasuryMultiplier: 0.5, // Consumed from the Brokers by treasury for re-allocation to finance Validators
			read: 0.00000001, // value in USD
			...(core.poolConfig.fees || {}),
		},
	};
};
