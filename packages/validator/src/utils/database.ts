import { open } from 'lmdb';

export class Database {
	public static create(name: string, dbPath: string) {
		return open({
			name,
			path: dbPath,
			compression: true,
			encoding: 'json',
		});
	}
}
