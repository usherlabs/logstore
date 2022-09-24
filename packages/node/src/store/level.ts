import { ClassicLevel } from 'classic-level';
import { existsSync, mkdirSync } from 'fs';
import { ICache } from '@/types';

export class LevelStore implements ICache {
	public name = 'Level';

	public path!: string;

	protected _db!: ClassicLevel;

	init(path: string): this {
		this.path = path;

		if (!existsSync(this.path)) {
			mkdirSync(this.path, { recursive: true });
		}

		this._db = new ClassicLevel(this.path, { valueEncoding: 'json' });

		return this;
	}

	private async db(): Promise<ClassicLevel> {
		if (!this._db) {
			throw new Error('Database is not initialised');
		}
		if (this._db.status === 'closed') {
			await this._db.open();
		}
		return this._db;
	}

	public async put(key: string | number, value: any): Promise<void> {
		const db = await this.db();
		await db.put(key.toString(), value);
	}

	public async get(key: string | number): Promise<any> {
		const db = await this.db();
		return db.get(key.toString());
	}

	public async del(key: string | number): Promise<void> {
		const db = await this.db();
		await db.del(key.toString());
	}

	public async drop(height?: number): Promise<void> {
		const db = await this.db();
		if (typeof height === 'number') {
			await db.clear({ gte: height });
		} else {
			await db.clear();
		}
	}

	public async exists(key: string | number): Promise<boolean> {
		const v = await this.get(key);
		if (typeof v !== 'undefined') {
			return true;
		}

		return false;
	}
}
