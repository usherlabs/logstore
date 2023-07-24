// import chokidar from 'chokidar';
import { sha256 } from '@kyvejs/protocol';
import { LogStoreClient, MessageMetadata, Stream } from '@logsn/client';
import {
	ProofOfMessageStored,
	QueryRequest,
	QueryResponse,
	SystemMessage,
	SystemMessageType,
} from '@logsn/protocol';
import fse from 'fs-extra';
import path from 'path';
import type { Logger } from 'tslog';

import { StreamSubscriber } from '../shared/StreamSubscriber';
import { SystemDb } from './SystemDb';

export class SystemListener {
	protected _cachePath: string;
	private readonly _subscriber: StreamSubscriber;
	private _db: SystemDb;
	private _startTime: number;

	constructor(
		homeDir: string,
		private readonly _client: LogStoreClient,
		private readonly _systemStream: Stream,
		protected logger: Logger
	) {
		this._subscriber = new StreamSubscriber(this._client, this._systemStream);

		this._cachePath = path.join(homeDir, '.logstore-metadata');
		this._db = new SystemDb();
	}

	public get startTime() {
		return this._startTime;
	}

	public get client() {
		return this._client;
	}

	public get db() {
		return this._db;
	}

	public async start(): Promise<void> {
		try {
			await fse.remove(this._cachePath);

			this._db.open(this._cachePath);

			// const systemSubscription =
			this.logger.info('Starting System Listener ...');
			this.logger.debug(`System Stream Id: `, this._systemStream.id);
			await this._subscriber.subscribe(this.onMessage.bind(this));

			// Store a timestamp for when the listener starts so that the Node must have a timestamp < bundle_start_key to pariticpate.
			this._startTime = Date.now();
		} catch (e) {
			this.logger.error(`Unexpected error starting listener...`);
			this.logger.error(e);
			throw e; // Fail if there's an issue with listening to data critical to performance of validator.
		}
	}

	public async stop() {
		await this._subscriber.unsubscribe();
	}

	private async onMessage(
		content: unknown,
		metadata: MessageMetadata
	): Promise<void> {
		// Add to store
		const systemMessage = SystemMessage.deserialize(content);
		// this.logger.debug('onMessage', parsedContent);

		if (
			[
				SystemMessageType.ProofOfMessageStored,
				SystemMessageType.QueryRequest,
				SystemMessageType.QueryResponse,
			].includes(systemMessage.messageType) === false
		) {
			return;
		}

		const hash = sha256(
			Buffer.from(JSON.stringify({ systemMessage: systemMessage, metadata }))
		);

		switch (systemMessage.messageType) {
			case SystemMessageType.ProofOfMessageStored: {
				const proof = systemMessage as ProofOfMessageStored;
				/**
					Cache with the timestamp in Proof (point at which the developer submits the message), rather than the timestamp of the metadata (point at which the broker submits the proof)
					This prevents issues associated to eventual consistency on the decentralised network
				 */
				const db = this._db.storeDb();
				// represent the items in the DB as
				const key = proof.timestamp;

				this.logger.debug('ProofOfMessageStored', {
					key,
					value: { content, metadata },
				});

				// content.timestamp => [{content1, metadata1}, {content2, metadata2}]
				await db.transaction(() => {
					const messages = db.get(key) || [];
					if (messages.find((m) => m.hash === hash) != undefined) {
						return true;
					}

					messages.push({
						message: {
							content: proof,
							metadata,
						},
						hash,
					});

					return db.put(key, messages);
				});

				break;
			}
			case SystemMessageType.QueryRequest: {
				const queryRequest = systemMessage as QueryRequest;

				// Query requests can use point at which broker publishes message because only a single broker will ever emit a query request message
				const db = this._db.queryRequestDb();
				const key = metadata.timestamp;
				this.logger.debug('QueryRequest', {
					key,
					value: { systemMessage: systemMessage, metadata },
				});

				await db.transaction(() => {
					const messages = db.get(key) || [];
					if (messages.find((m) => m.hash === hash) != undefined) {
						return true;
					}

					messages.push({
						message: {
							content: queryRequest,
							metadata,
						},
						hash,
					});

					return db.put(key, messages);
				});
				break;
			}
			case SystemMessageType.QueryResponse: {
				const queryResponse = systemMessage as QueryResponse;
				const db = this._db.queryResponseDb();
				// represent the items in the response DB as
				// requestId => [{content1, metadata1}, {content2, metadata2}]
				await db.transaction(() => {
					const key = queryResponse.requestId;
					const messages = db.get(key) || [];
					if (messages.find((m) => m.hash === hash) != undefined) {
						return true;
					}

					messages.push({
						message: {
							content: queryResponse,
							metadata,
						},
						hash,
					});

					return db.put(key, messages); // for every query request id, there will be an array of responses collected from the Broker network
				});
				break;
			}
			default: {
				break;
			}
		}
	}
}
