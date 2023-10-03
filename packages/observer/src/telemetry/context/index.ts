import { AsyncLocalStorage } from 'async_hooks';

export const ctx = {
	nodeInfo: new AsyncLocalStorage<{ id: string }>(),
};

export type StoreType<T> = T extends AsyncLocalStorage<infer U> ? U : never;
