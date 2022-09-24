import { ClassicLevel } from 'classic-level';
import { AbstractSublevel } from 'abstract-level';

export class IsolatedLevelStore {
	protected isolate!: AbstractSublevel<
		ClassicLevel<string, string>,
		string | Buffer,
		string,
		string
	>;

	constructor(protected db: ClassicLevel, protected id: string) {
		this.isolate = this.db.sublevel(id);
	}

	public async get(key: string | number) {
		if (!(await this.exists(key))) {
			return null;
		}

		return this.db.get(key.toString());
	}

	public async filter(filters: Record<string, (value: any) => boolean>) {
		const filterKeys = Object.keys(filters);
		const results = [];
		for await (const key of this.isolate.keys()) {
			console.log(`isolate filter key: ${key}`);
			const v = this.db.get(key);
			if (typeof v === 'object') {
				filterKeys.forEach((fkey) => {
					// ignores non-function predicates
					if (typeof filters[fkey] !== 'function') {
						return true;
					}
					const match = filters[fkey](v[fkey]);
					if (match) {
						results.push({
							key,
							value: v,
						});
					}
				});
			}
		}
	}

	public async exists(key: string | number) {
		try {
			await this.isolate.get(key.toString());
			return true;
		} catch (e) {
			if (e.code !== 'LEVEL_NOT_FOUND') {
				throw e;
			}
		}
		return false;
	}
}
