/**
 * ? What this script demonstrates is that lmdb will actually create two separate instances of the DB, but when using the same path with no { name }, will reference the same store.
 *
 * This means that the listener cache must reference different paths to differentiate.
 */
import { open, RootDatabase } from 'lmdb';
import path from 'path';

type DB = RootDatabase<string, number>;
type ResponseDB = RootDatabase<string, number>;

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
		encoding: 'json',
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
	const values = [db1.get(100), db1.get(101), db2.get(100), db2.get(101)];

	await db1.put(1, 'hello');
	await db2.put(2, 'world');

	const c = db1.getRange({
		start: -5,
		end: 5,
	});
	// ();
	const c2 = db2.getRange({
		start: -5,
		end: 5,
	});
	// ();

	for (const v of c) {
		console.log('db1:', v);
	}
	for (const v of c2) {
		console.log('db2:', v);
	}

	console.log('values', values);
})();
