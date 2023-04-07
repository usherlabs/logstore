import chokidar from 'chokidar';
import { ClassicLevel } from 'classic-level';
import path from 'path';
import StreamrClient, { MessageMetadata } from 'streamr-client';

import type { StreamrMessage } from './types';
import type Validator from './validator';

export default class Listener {
	private client: StreamrClient;
	private _db!: ClassicLevel<string, StreamrMessage>;
	private cachePath: string;
	// private _storeMap: Record<string, string[]>;

	constructor(private core: Validator, cacheHome: string) {
		this.client = new StreamrClient();

		// Kyve cache dir would have already setup this directory
		// On each new bundle, this cache will be deleted
		this.cachePath = path.join(cacheHome, 'system');
		this._db = this.createDb(this.cachePath);
	}

	public async start(): Promise<void> {
		try {
			// const systemSubscription =
			this.core.logger.info('Starting listeners ...');
			this.core.logger.debug(`System Stream Id: `, this.core.systemStreamId);
			await this.subscribe(this.core.systemStreamId);

			// First key in the cache is a timestamp that is comparable to the bundle start key -- ie. Node must have a timestamp < bundle_start_key
			const db = await this.db();
			await db.clear();
			await db.put(Date.now().toString(), null);

			// Chokidar listening to reinitiate the cache after each flush/drop/wipe.
			chokidar.watch(this.cachePath).on('unlink', async (eventPath) => {
				if (eventPath == this.cachePath) {
					const db = await this.db();
					await db.put(Date.now().toString(), null);

					this.core.logger.info('System cache removed and reinitialised.');
				}
			});
		} catch (e) {
			this.core.logger.error(`Unexpected error starting listener...`);
			this.core.logger.error(e);
		}
	}

	public async stop() {
		await this.client.unsubscribe();
	}

	public async subscribe(streamId: string) {
		await this.client.subscribe(streamId, (content, metadata) => {
			return this.onMessage(content, metadata);
		});
	}

	public async db(): Promise<ClassicLevel<string, StreamrMessage>> {
		if (!this._db) {
			throw new Error('Database is not initialised');
		}
		if (this._db.status === 'closed') {
			await this._db.open();
		}
		return this._db;
	}

	public createDb(dbPath: string) {
		return new ClassicLevel<string, StreamrMessage>(dbPath, {
			valueEncoding: 'json',
		});
	}

	// public getStoreMap(){
	// 	return this._storeMap;
	// }

	private async onMessage(content: any, metadata: MessageMetadata) {
		// Add to store
		const key = `${Date.now().toString()}:${metadata.publisherId}`;

		this.core.logger.debug(
			'New message received over stream: ' + metadata.streamId,
			{
				key,
				value: { content, metadata },
			}
		);

		const db = await this.db();
		await db.put(key, { content, metadata });
	}
}
