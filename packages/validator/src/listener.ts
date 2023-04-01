import chokidar from 'chokidar';
import { ClassicLevel } from 'classic-level';
import path from 'path';
import StreamrClient, { MessageMetadata } from 'streamr-client';

import type { StreamrMessage } from './types';
import type Validator from './validator';

export default class Listener {
	private client: StreamrClient;
	private _db!: ClassicLevel<string, StreamrMessage>;
	// private _storeMap: Record<string, string[]>;

	constructor(private core: Validator) {
		this.client = new StreamrClient();
	}

	public async start(cacheHome: string): Promise<void> {
		try {
			// const systemSubscription =
			this.core.logger.info('Starting listeners ...');
			this.core.logger.debug(`System Stream Id: `, this.core.systemStreamId);
			this.core.logger.debug(`Query Stream Id: `, this.core.queryStreamId);
			await this.subscribe(this.core.systemStreamId);
			await this.subscribe(this.core.queryStreamId);

			// Kyve cache dir would have already setup this directory
			// On each new bundle, this cache will be deleted
			const cachePath = path.join(cacheHome, 'system');
			this._db = new ClassicLevel<string, StreamrMessage>(cachePath, {
				valueEncoding: 'json',
			});

			// First key in the cache is a timestamp that is comparable to the bundle start key -- ie. Node must have a timestamp < bundle_start_key
			const db = await this.db();
			await db.clear();
			await db.put(Date.now().toString(), null);

			// Chokidar listening to reinitiate the cache after each flush/drop/wipe.
			chokidar.watch(cachePath).on('unlink', async (eventPath) => {
				if (eventPath == cachePath) {
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

	// public getStoreMap(){
	// 	return this._storeMap;
	// }

	private async onMessage(content: any, metadata: MessageMetadata) {
		// Add to store
		const key = `${Date.now().toString()}:${metadata.streamId}:${
			metadata.publisherId
		}`;

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
