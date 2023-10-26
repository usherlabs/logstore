import { AsyncLocalStorage } from 'async_hooks';

import { IRuntimeExtended } from '../types';

export const validatorContext = new AsyncLocalStorage<{
	runtime: IRuntimeExtended;
	validatorJoinePooldAt: number;
}>();
