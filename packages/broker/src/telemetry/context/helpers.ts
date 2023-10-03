import { Counter } from '@opentelemetry/api';
import { AsyncLocalStorage } from 'async_hooks';

type AsyncLocalStorageWithGetter<T> = [
	AsyncLocalStorage<T>,
	(a: T | undefined) => any,
];
type ContextMapperValue<T = any> =
	| AsyncLocalStorage<T>
	| AsyncLocalStorageWithGetter<T>;
type ContextMapper<T extends Record<string, any>> = {
	[K in keyof T]: ContextMapperValue<T[K]>;
};

/**
 * Increment a counter with additional context values using a context mapper function.
 */
export const incrementCounterWithCtx =
	<T extends Record<string, any>>(
		counter: Counter,
		ctxMapper: ContextMapper<T>
	) =>
	(n: number) => {
		const stores = Object.entries(ctxMapper).reduce(
			(acc, [key, store]) => {
				if (Array.isArray(store)) {
					acc[key] = store[1](store[0].getStore());
				} else {
					acc[key] = store.getStore();
				}
				return acc;
			},
			{} as Record<string, any>
		);

		return counter.add(n, stores);
	};
