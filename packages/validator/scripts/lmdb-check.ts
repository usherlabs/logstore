/**
 * ? This script simply checks the state of the lmdb
 *
 */
import { open, RootDatabase } from 'lmdb';
import path from 'path';

type DB = RootDatabase<string, number>;

const createDB = (name, p) => {
	return open({
		name,
		path: p,
		compression: true,
		encoding: 'json',
	});
};

const cacheHome = path.join(__dirname, './cache');
const cachePath = path.join(cacheHome, './system');

const db = createDB('test', cachePath) as DB;

(async () => {
	// await db.drop();

	const c = db.getRange({
		start: 0,
		end: 5,
	});

	for (const v of c) {
		console.log('check db:', v);
	}
})();
