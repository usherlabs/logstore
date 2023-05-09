// import { Cama } from 'camadb';
// import { LogLevel } from 'camadb/dist/interfaces/logger-level.enum';
// import { PersistenceAdapterEnum } from 'camadb/dist/interfaces/perisistence-adapter.enum';
// import chokidar from 'chokidar';
import {
	QueryResponse,
	SystemMessage,
	SystemMessageType,
} from '@concertodao/logstore-protocol';
import { open, RootDatabase } from 'lmdb';
import path from 'path';
import StreamrClient, { CONFIG_TEST, MessageMetadata } from 'streamr-client';

import { useStreamrTestConfig } from './env-config';
import type { StreamrMessage } from './types';
import type Validator from './validator';

// -------------> usual storage of QueryRequest and POS in listener cache
// timestamp(number)|requestId(string) => [{content, metadata},{content, metadata}]
type DB = RootDatabase<Array<StreamrMessage>, number>;
type ResponseDB = RootDatabase<StreamrMessage[], string>;

export default class Listener {
	private client: StreamrClient;
	private _db!: DB;
	private _queryResponsedb!: ResponseDB;
	private cachePath: string;
	// private _storeMap: Record<string, string[]>;

	constructor(protected core: Validator, cacheHome: string) {
		const streamrConfig = useStreamrTestConfig() ? CONFIG_TEST : {};
		// core.logger.debug('Streamr Config', streamrConfig);
		this.client = new StreamrClient(streamrConfig);

		// Kyve cache dir would have already setup this directory
		// On each new bundle, this cache will be deleted
		this.cachePath = path.join(cacheHome, 'system');
		this._db = this.createDb(this.cachePath) as DB;
		this._queryResponsedb = this.createDb(this.cachePath) as ResponseDB;
	}

	public async start(): Promise<void> {
		try {
			// const systemSubscription =
			this.core.logger.info('Starting listeners ...');
			this.core.logger.debug(`System Stream Id: `, this.core.systemStreamId);
			await this.subscribe(this.core.systemStreamId);

			// First key in the cache is a timestamp that is comparable to the bundle start key -- ie. Node must have a timestamp < bundle_start_key
			const db = this.db();
			await db.drop();
			await db.put(+Date.now(), null);

			// drop the response DB

			// Chokidar listening to reinitiate the cache after each flush/drop/wipe.
			// chokidar.watch(this.cachePath).on('unlink', async (eventPath) => {
			// 	if (eventPath == this.cachePath) {
			// 		const db = await this.db();
			// 		await db.put(Date.now().toString(), null);

			// 		this.core.logger.info('System cache removed and reinitialised.');
			// 	}
			// });
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
			return this.onMessage(content as any[], metadata);
		});
	}

	public db(): DB {
		if (!this._db) {
			throw new Error('Database is not initialised');
		}
		return this._db;
	}

	public responseDB(): ResponseDB {
		if (!this._queryResponsedb) {
			throw new Error('Response Database is not initialised');
		}
		return this._queryResponsedb;
	}

	public createDb(dbPath: string) {
		return open({
			path: dbPath,
			compression: true,
			encoding: 'json',
		});
	}

	public atIndex(index: number) {
		const db = this.db();
		for (const item of db.getRange({ offset: index, limit: 1 })) {
			return item;
		}
		throw new Error(`atIndex: No key at index: ${index}`);
	}

	private async onMessage(content: any[], metadata: MessageMetadata) {
		// Add to store
		const key = metadata.timestamp;

		this.core.logger.debug(
			'New message received over stream: ' + metadata.streamId,
			{
				key,
				value: { content, metadata },
			}
		);

		// deserialize the content gotten
		const parsedContent = SystemMessage.deserialize(content);
		const db = this.db();
		const responseDB = this.responseDB();
		// if its a query response handle it differetly from proof of storage and query requests
		if (parsedContent.messageType !== SystemMessageType.QueryResponse) {
			// represent the items in the DB as
			// timestamp => [{content1, metadata1}, {content2, metadata2}]
			const value = db.get(key) || [];
			value.push({
				content: parsedContent,
				metadata,
			});
			await db.put(key, value);
		} else {
			// represent the items in the response DB as
			// requestId => [{content1, metadata1}, {content2, metadata2}]
			const responseContent = parsedContent as QueryResponse;
			const requestKey = responseContent.requestId;
			const existingResponse = responseDB.get(requestKey) || [];
			existingResponse.push({ content: parsedContent, metadata });
			await responseDB.put(requestKey, existingResponse);
		}
	}
}
