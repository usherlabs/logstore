// import chokidar from 'chokidar';
import { sha256 } from '@kyvejs/protocol';
import { LogStoreClient, MessageMetadata } from '@logsn/client';
import {
	ProofOfMessageStored,
	QueryPropagate,
	QueryRequest,
	QueryResponse,
	SystemMessage,
	SystemMessageType,
} from '@logsn/protocol';
import fse from 'fs-extra';
import path from 'path';
import type { Logger } from 'tslog';

import { BroadbandSubscriber } from '../shared/BroadbandSubscriber';
import { MessageMetricsSummary } from '../shared/MessageMetricsSummary';
import { SystemDb } from './SystemDb';
import { SystemRecovery } from './SystemRecovery';

const LISTENING_MESSAGE_TYPES = [
	SystemMessageType.ProofOfMessageStored,
	SystemMessageType.QueryRequest,
	SystemMessageType.QueryResponse,
	SystemMessageType.QueryPropagate,
];

export class SystemListener {
	private readonly _cachePath: string;
	private readonly _db: SystemDb;
	private _latestTimestamp: number;

	constructor(
		homeDir: string,
		private readonly _client: LogStoreClient,
		private readonly _systemSubscriber: BroadbandSubscriber,
		private readonly _systemRecovery: SystemRecovery,
		private readonly messageMetricsSummary: MessageMetricsSummary,
		private readonly logger: Logger
	) {
		this._cachePath = path.join(homeDir, '.logstore-metadata');
		this._db = new SystemDb();
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

			this.logger.info('Starting SystemListener ...');
			await this._systemSubscriber.subscribe((content, metadata) =>
				setImmediate(() => this.onMessage(content, metadata))
			);

			await this._systemRecovery.start(this.onSystemMessage.bind(this));
		} catch (e) {
			this.logger.error(`Unexpected error starting listener...`);
			this.logger.error(e);
			throw e; // Fail if there's an issue with listening to data critical to performance of validator.
		}
	}

	public async stop() {
		await this._systemRecovery.stop();
		await this._systemSubscriber.unsubscribe();
	}

	public get latestTimestamp() {
		if (!this._systemRecovery.progress.isComplete) {
			return this._systemRecovery.progress.timestamp;
		}
		return Math.max(
			this._latestTimestamp || 0,
			this._systemRecovery.progress.timestamp
		);
	}

	private async onMessage(
		content: unknown,
		metadata: MessageMetadata
	): Promise<void> {
		this.messageMetricsSummary.update(content, metadata);

		const systemMessage = SystemMessage.deserialize(content);
		if (!LISTENING_MESSAGE_TYPES.includes(systemMessage.messageType)) {
			return;
		}

		this._latestTimestamp = metadata.timestamp;

		await this.onSystemMessage(systemMessage, metadata);
	}

	private async onSystemMessage(
		systemMessage: SystemMessage,
		metadata: MessageMetadata
	) {
		const systemMessageMetadata = {
			streamId: metadata.streamId,
			streamPartition: metadata.streamPartition,
			timestamp: metadata.timestamp,
			sequenceNumber: metadata.sequenceNumber,
			signature: metadata.signature,
			publisherId: metadata.publisherId,
			msgChainId: metadata.msgChainId,
		};
		const hash = sha256(
			Buffer.from(
				JSON.stringify({
					systemMessage,
					systemMessageMetadata,
				})
			)
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

				this.logger.debug(
					`Storing ProofOfMessageStored ${JSON.stringify({
						key,
						value: { proof, systemMessageMetadata },
					})}`
				);

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
				this.logger.debug(
					`Storing QueryRequest ${JSON.stringify({
						key,
						value: { queryRequest, systemMessageMetadata },
					})}`
				);

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
				const key = queryResponse.requestId;
				this.logger.debug(
					`Storing QueryResponse ${JSON.stringify({
						key,
						value: { queryResponse, systemMessageMetadata },
					})}`
				);
				// represent the items in the response DB as
				// requestId => [{content1, metadata1}, {content2, metadata2}]
				await db.transaction(() => {
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
			case SystemMessageType.QueryPropagate: {
				const queryPropagate = systemMessage as QueryPropagate;
				const db = this._db.queryPropagateDb();
				const key = queryPropagate.requestId;
				this.logger.debug(
					`Storing QueryPropagate ${JSON.stringify({
						key,
						value: { queryPropagate, systemMessageMetadata },
					})}`
				);
				// represent the items in the propagate DB as
				// requestId => [{content1, metadata1}, {content2, metadata2}]
				await db.transaction(() => {
					const messages = db.get(key) || [];
					if (messages.find((m) => m.hash === hash) != undefined) {
						return true;
					}

					messages.push({
						message: {
							content: queryPropagate,
							metadata,
						},
						hash,
					});

					return db.put(key, messages); // for every query request id, there will be an array of propagates collected from the Broker network
				});
				break;
			}
			default: {
				break;
			}
		}
	}
}
