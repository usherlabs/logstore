import { LevelStore } from '../src/localstore';

const store = new LevelStore();

const cache = store.init('./cache/scripts');

(async () => {
	await cache.put('hello-world', { hello: 'world' });

	console.log(await cache.get('hello-world'));
})();
