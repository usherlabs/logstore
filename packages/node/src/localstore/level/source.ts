import { ISourceCache } from '@/types';
import { LevelSublevel } from './types';

export class SourceLevelStore implements ISourceCache {
	constructor(public db: LevelSublevel) {}

	public get height() {
		return this.db.keys().count;
	}

	public async put(key: string | number, value: any): Promise<void> {
		await this.db.put(key.toString(), value);
	}

	public async get(key: string | number): Promise<any> {
		return this.db.get(key.toString());
	}

	public async del(key: string | number): Promise<void> {
		await this.db.del(key.toString());
	}

	public async drop(height?: number): Promise<void> {
		if (typeof height === 'number') {
			await this.db.clear({ gte: height });
		} else {
			throw new Error('Height must be provided to drop from cache');
		}
	}

	public async reset(keyHeight: number): Promise<void> {
		const height = await this.db.keys().count;
		for (let i = height - 1; i > 0; i -= 1) {
			// iterate backwards over source cache -- and remove with key-in-value greater or equal to keyHeight
			const value = (await this.db.get(i.toString())) as any;
			if (value?.key) {
				if (+value.key >= keyHeight) {
					const { key, ...newValue } = value;
					await this.db.put(i.toString(), newValue);
				} else {
					// Exit out of loop when events are reached where the keys are valid
					break;
				}
			}
		}
	}

	public async exists(key: string | number): Promise<boolean> {
		try {
			await this.get(key);
			return true;
		} catch (e) {
			if (e.code !== 'LEVEL_NOT_FOUND') {
				throw e;
			}
		}
		return false;
	}
}
