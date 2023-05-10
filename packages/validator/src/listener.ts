// import chokidar from 'chokidar';
import {
	ProofOfMessageStored,
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
type NumberKeyDatabase = RootDatabase<Array<StreamrMessage>, number>;
type StringKeyDatabase = RootDatabase<Array<StreamrMessage>, string>;
type DB = {
	[SystemMessageType.ProofOfMessageStored]: NumberKeyDatabase;
	[SystemMessageType.QueryRequest]: NumberKeyDatabase;
	[SystemMessageType.QueryResponse]: StringKeyDatabase;
};

export default class Listener {
	private client: StreamrClient;
	private _db!: DB;
	private cachePath: string;
	private _startTime: number;
	// private _storeMap: Record<string, string[]>;

	constructor(protected core: Validator, cacheHome: string) {
		const streamrConfig = useStreamrTestConfig() ? CONFIG_TEST : {};
		// core.logger.debug('Streamr Config', streamrConfig);
		this.client = new StreamrClient(streamrConfig);

		// Kyve cache dir would have already setup this directory
		// On each new bundle, this cache will be deleted
		this.cachePath = path.join(cacheHome, 'system');
		this._db = {
			[SystemMessageType.ProofOfMessageStored]: this.createDb(
				'ProofOfMessageStored',
				this.cachePath
			),
			[SystemMessageType.QueryRequest]: this.createDb(
				'QueryRequest',
				this.cachePath
			),
			[SystemMessageType.QueryResponse]: this.createDb(
				'QueryResponse',
				this.cachePath
			),
		} as DB;
	}

	public get startTime() {
		return this._startTime;
	}

	public async start(): Promise<void> {
		try {
			// const systemSubscription =
			this.core.logger.info('Starting listeners ...');
			this.core.logger.debug(`System Stream Id: `, this.core.systemStreamId);
			await this.subscribe(this.core.systemStreamId);

			this._startTime = Date.now();
			// First key in the cache is a timestamp that is comparable to the bundle start key -- ie. Node must have a timestamp < bundle_start_key
			const dbTypes = Object.values(SystemMessageType);
			for (let i = 0; i < dbTypes.length; i++) {
				await this.db(dbTypes[i] as SystemMessageType).drop();
			}

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

	public storeDb() {
		return this.db<NumberKeyDatabase>(SystemMessageType.ProofOfMessageStored);
	}

	public queryRequestDb() {
		return this.db<NumberKeyDatabase>(SystemMessageType.QueryRequest);
	}

	public queryResponseDb() {
		return this.db<StringKeyDatabase>(SystemMessageType.QueryRequest);
	}

	private db<T = NumberKeyDatabase | StringKeyDatabase>(
		type: SystemMessageType
	) {
		if (!this._db[type]) {
			throw new Error('Database is not initialised');
		}
		return this._db[type] as T;
	}

	private createDb(name: string, dbPath: string) {
		return open({
			name,
			path: dbPath,
			compression: true,
			encoding: 'json',
		});
	}

	private async onMessage(content: any[], metadata: MessageMetadata) {
		// Add to store
		const parsedContent = SystemMessage.deserialize(content);
		switch (parsedContent.messageType) {
			case SystemMessageType.ProofOfMessageStored: {
				/**
					Cache with the timestamp in Proof (point at which the developer submits the message), rather than the timestamp of the metadata (point at which the broker submits the proof)
					This prevents issues associated to eventual consistency on the decentralised network
				 */
				const db = this.storeDb();
				// represent the items in the DB as
				const proof = parsedContent as ProofOfMessageStored;
				const key = proof.timestamp;

				this.core.logger.debug('ProofOfMessageStored', {
					key,
					value: { content, metadata },
				});

				// content.timestamp => [{content1, metadata1}, {content2, metadata2}]
				const value = db.get(key) || [];
				value.push({
					content: parsedContent,
					metadata,
				});
				// Sort the values by their sequenceNumber to ensure they're deterministically ordered
				value.sort((a, b) => {
					if (a.content.sequenceNumber < b.content.sequenceNumber) {
						return -1;
					}
					if (a.content.sequenceNumber > b.content.sequenceNumber) {
						return 1;
					}
					return 0;
				});
				await db.put(key, value);
				break;
			}
			case SystemMessageType.QueryRequest: {
				// Query requests can use point at which broker publishes message because only a single broker will ever emit a query request message
				const db = this.queryRequestDb();
				const key = metadata.timestamp;
				this.core.logger.debug('QueryRequest', {
					key,
					value: { content, metadata },
				});

				// content.timestamp => [{content1, metadata1}, {content2, metadata2}]
				const value = db.get(key) || [];
				value.push({
					content: parsedContent,
					metadata,
				});
				// Sort the values by their sequenceNumber to ensure they're deterministically ordered
				value.sort((a, b) => {
					if (a.metadata.sequenceNumber < b.metadata.sequenceNumber) {
						return -1;
					}
					if (a.metadata.sequenceNumber > b.metadata.sequenceNumber) {
						return 1;
					}
					return 0;
				});
				await db.put(key, value);
				break;
			}
			case SystemMessageType.QueryResponse: {
				const db = this.queryResponseDb();
				// represent the items in the response DB as
				// requestId => [{content1, metadata1}, {content2, metadata2}]
				const responseContent = parsedContent as QueryResponse;
				const requestKey = responseContent.requestId;
				const existingResponse = db.get(requestKey) || [];
				existingResponse.push({ content: parsedContent, metadata });
				await db.put(requestKey, existingResponse); // for every query request id, there will be an array of responses collected from the Broker network
				break;
			}
			default: {
				break;
			}
		}
	}
}
