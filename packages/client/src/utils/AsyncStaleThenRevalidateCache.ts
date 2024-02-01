type CacheConfig = {
	maxAge: number;
};

/**
 * `AsyncStaleThenRevalidateCache` is a generic class that implements a caching strategy known as "stale-while-revalidate".
 * This strategy allows the cache to return stale or outdated data while it fetches the new data in the background.
 * The class is generic and can work with any type of key-value pairs.
 *
 * @template K Type of the keys in the cache.
 * @template V Type of the values in the cache. Can be a value or a Promise that resolves to a value.
 */
export class AsyncStaleThenRevalidateCache<K, V> {
	/**
	 * The store is a Map that holds the cache data. Each entry in the map is an object with the actual value and a timestamp.
	 */
	private store = new Map<K, { value: V | Promise<V>; timestamp: number }>();
	/**
	 * The maximum age (in milliseconds) that an item can stay in the cache before it's considered stale.
	 */
	private maxAge: number;

	constructor(config: CacheConfig) {
		this.maxAge = config.maxAge;
	}

	/**
	 * Sets a new value in the cache. Also triggers a cleanup of the cache.
	 *
	 * @param {K} key The key of the item.
	 * @param {V | Promise<V>} value The value of the item. Can be a Promise.
	 */
	set(key: K, value: V | Promise<V>): void {
		this.store.set(key, { value, timestamp: Date.now() });
		this.cleanup();
	}

	/**
	 * Retrieves a value from the cache. If the value is stale, it triggers a background refresh of the data.
	 *
	 * @param {K} key The key of the item.
	 * @param {() => Promise<V>} getFreshDataHandler A function that returns a Promise which resolves to the fresh data.
	 * @returns {V | Promise<V>} The cached value or a Promise that resolves to the value.
	 */
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

	/**
	 * Cleans up the cache by removing entries that are older than the maxAge.
	 */
	private cleanup(): void {
		const now = Date.now();
		Array.from(this.store.entries()).forEach(([key, { timestamp }]) => {
			if (now - timestamp > this.maxAge) {
				this.store.delete(key);
			}
		});
	}
}
