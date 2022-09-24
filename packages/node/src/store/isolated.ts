import { ClassicLevel } from 'classic-level';
import { ICacheIsolate } from '@/types';

export class IsolatedLevelStore implements ICacheIsolate {
	constructor(protected db: ClassicLevel, protected id: string) {}

	public async get(key: string | number) {
		if (!(await this.exists(key))) {
			return null;
		}

		return this.db.get(key.toString());
	}

	public async *iterator() {
		for await (const [key, value] of this.db.iterator()) {
			console.log(`isolate filter key: ${key}`);
			const v = value as any;
			if (v?.pipeline === this.id) {
				yield v;
			}
		}
	}

	public async exists(key: string | number) {
		try {
			const value = (await this.db.get(key.toString())) as any;
			if (value?.pipeline === this.id) {
				return true;
			}
		} catch (e) {
			if (e.code !== 'LEVEL_NOT_FOUND') {
				throw e;
			}
		}
		return false;
	}
}
