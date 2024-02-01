type CacheConfig = {
	maxAge: number;
};

export class AsyncStaleThenRevalidateCache<K, V> {
	private store = new Map<K, { value: V | Promise<V>; timestamp: number }>();
	private maxAge: number;

	constructor(config: CacheConfig) {
		this.maxAge = config.maxAge;
	}

	set(key: K, value: V | Promise<V>): void {
		this.store.set(key, { value, timestamp: Date.now() });
		this.cleanup();
	}

	get(key: K, getFreshDataHandler: () => Promise<V>): V | Promise<V> {
		const item = this.store.get(key);
		if (item) {
			if (Date.now() - item.timestamp < this.maxAge) {
				return item.value;
			} else {
				// here we can't avoid the risk of multiple requests for the same key
				getFreshDataHandler().then((value) => {
					this.set(key, value);
				});
				// return the stale data, while we get the new one in the background
				return item.value;
			}
		}

		const resultPromise = getFreshDataHandler();

		// update the cache with the new value once it's available
		resultPromise.then((value) => {
			this.set(key, value);
		});

		// cache the promise to avoid multiple requests for the same key
		this.set(key, resultPromise);

		// return the promise
		return resultPromise;
	}

	private cleanup(): void {
		const now = Date.now();
		Array.from(this.store.entries()).forEach(([key, { timestamp }]) => {
			if (now - timestamp > this.maxAge) {
				this.store.delete(key);
			}
		});
	}
}
