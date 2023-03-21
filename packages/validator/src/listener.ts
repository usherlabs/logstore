import { ClassicLevel } from 'classic-level';
import path from 'path';
import StreamrClient from 'streamr-client';

const SystemStreamId = '' as const;
// const QuerySystemStreamId = '' as const;

export default class Listener {
	private client: StreamrClient;
	private _db!: ClassicLevel;

	constructor() {
		this.client = new StreamrClient();
	}

	public async start(cacheHome: string): Promise<void> {
		// const systemSubscription =
		await this.client.subscribe(SystemStreamId, async (content, metadata) => {
			const db = await this.db();
			await db.put(
				Date.now().toString(),
				JSON.stringify({ content, metadata })
			);
		});

		// Kyve cache dir would have already setup this directory
		// On each new bundle, this cache will be deleted
		const cachePath = path.join(cacheHome, 'cache/system');
		this._db = new ClassicLevel(cachePath, { valueEncoding: 'json' });

		// First key in the cache is a timestamp that is comparable to the bundle start key -- ie. Node must have a timestamp < bundle_start_key
		const db = await this.db();
		await db.put(Date.now().toString(), '');
	}

	public async db(): Promise<ClassicLevel> {
		if (!this._db) {
			throw new Error('Database is not initialised');
		}
		if (this._db.status === 'closed') {
			await this._db.open();
		}
		return this._db;
	}
}
