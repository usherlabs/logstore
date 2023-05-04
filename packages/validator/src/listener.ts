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
// timestamp(number) => {node1 => {content, metadata},node1 => {content, metadata}}
// -------------> way in which requests are stored to efficiently retrieve the request object and how many nodes have sent it over
// requestid(string) => {request => {content, metadata}, count => 10}}
type DB = RootDatabase<
	Record<string, StreamrMessage | number>,
	number | string
>;

export default class Listener {
	private client: StreamrClient;
	private _db!: DB;
	private cachePath: string;
	// private _storeMap: Record<string, string[]>;

	constructor(private core: Validator, cacheHome: string) {
		const streamrConfig = useStreamrTestConfig() ? CONFIG_TEST : {};
		// core.logger.debug('Streamr Config', streamrConfig);
		this.client = new StreamrClient(streamrConfig);

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
			const db = this.db();
			await db.drop();
			await db.put(+Date.now(), null);

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
		// if (this._db.status === 'closed') {
		// 	await this._db.open();
		// }
		return this._db;
	}

	public createDb(dbPath: string) {
		return open<Record<string, StreamrMessage>, number>({
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
		const key = +Date.now();

		this.core.logger.debug(
			'New message received over stream: ' + metadata.streamId,
			{
				key,
				value: { content, metadata },
			}
		);
		// ? we are only going to store requests dorectly to the cache
		// ? we are then going to then just count the responses we recieve
		// deserialize the content gotten
		const parsedContent = SystemMessage.deserialize(content);
		const db = this.db();
		// if its a query response handle it differetly from proof of storage and query requests
		if (parsedContent.messageType !== SystemMessageType.QueryResponse) {
			// represent the items in the DB as
			// timestamp => {publisherId: {content, metadata}, publisherId2: {content, metadata}}

			// try getting the key first then updating later
			const value = db.get(key) || {};
			value[metadata.publisherId] = {
				content: parsedContent,
				metadata,
			};
			await db.put(key, value);
		} else {
			// ?need to map the request id to the response
			// ?need to maintain how many count we have gotten from the broker node
			// for each response check if teh request id exists in cache
			// if it exists increment its count
			// if it doesnt then do not increment the count
			const responseContent = parsedContent as QueryResponse;
			const requestKey = responseContent.requestId;
			let existingResponse = db.get(requestKey);
			if (!existingResponse) {
				existingResponse = {
					data: { content: parsedContent, metadata },
					count: 1,
				};
				await db.put(requestKey, existingResponse);
			} else {
				// TOOO validate that the response recieved is exactly the same before increasing the count
				// ? what if it is not, which would be marked as correct, first come first serve?
				existingResponse.count = +existingResponse.count + 1;
				await db.put(requestKey, existingResponse);
			}
		}
	}
}
