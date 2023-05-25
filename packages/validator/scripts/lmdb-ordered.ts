/**
 * ? What this script demonstrates is that lmdb will actually create two separate instances of the DB, but when using the same path with no { name }, will reference the same store.
 *
 * This means that the listener cache must reference different paths to differentiate.
 */
import { open, RootDatabase } from 'lmdb';
import path from 'path';

type DB = RootDatabase<any, number>;
type ResponseDB = RootDatabase<any, number>;

// const createDB = (p) => {
// 	return open({
// 		path: p,
// 		compression: true,
// 		encoding: 'json',
// 	});
// };

// const cachePath = path.join(__dirname, './cache');

// const db1 = createDB(cachePath) as DB;
// const db2 = createDB(cachePath) as ResponseDB;
/**
 * Without name, the result is:
 		db1: { key: 1, value: 'hello' }
		db1: { key: 2, value: 'world' }
		db2: { key: 1, value: 'hello' }
		db2: { key: 2, value: 'world' }
 */

const createDB = (name, p) => {
	return open({
		name,
		path: p,
		compression: true,
		// encoding: 'json',
		encoding: 'ordered-binary',
		dupSort: true,
	});
};

const cachePath = path.join(__dirname, './cache');

const db1 = createDB('ts', cachePath) as DB;
const db2 = createDB('query-response', cachePath) as ResponseDB;
/**
 * With name, the result is:
		db1: { key: 1, value: 'hello' }
		db2: { key: 2, value: 'world' }
 */

// const db1 = createDB(path.join(__dirname, './cache/db1')) as DB;
// const db2 = createDB(path.join(__dirname, './cache/db2')) as ResponseDB;

(async () => {
	await db1.put(1, JSON.stringify({ hello: true }));
	await db1.put(1, JSON.stringify({ hello2: true }));
	await db2.put(2, JSON.stringify({ world: true }));
	await db2.put(2, JSON.stringify({ world2: true }));

	const c = db1
		.getRange
		// {
		// start: 0,
		// end: 5,
		// }
		();
	const c2 = db2
		.getRange
		// {
		// start: 0,
		// end: 5,
		// }
		();

	for (const v of c) {
		console.log('db1:', v);
	}
	for (const v of c2) {
		console.log('db2:', v);
	}
})();
