/**
 * ? This script demonstrates how lmdb reacts to an - await fse.emptyDir(`${this.path}/`); caused by the Kyve JsonFileCache StorageProvider
 *
 * Findings:
 * It seems to keep all data in memory, but all persisted data is deleted.
 * It also does not re-initate the database on-disk after files are cleared.
 *
 * With Chokidar:
 *
 */
import chokidar from 'chokidar';
import fse from 'fs-extra';
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

let db = createDB('test', cachePath) as DB;

chokidar.watch(cachePath).on('unlinkDir', async (eventPath) => {
	console.log({ eventPath, cachePath });
	console.log('eventPath', eventPath);
	if (eventPath == cachePath) {
		db = createDB('test', cachePath) as DB;

		console.log('System cache removed and reinitialised.');
	}
});

(async () => {
	// await db.drop();

	await db.put(1, 'hello');
	await fse.emptyDir(`${cacheHome}/`);
	await db.put(2, 'world');

	const c = db.getRange({
		start: 0,
		end: 5,
	});

	for (const v of c) {
		console.log('db:', v);
	}
})();
