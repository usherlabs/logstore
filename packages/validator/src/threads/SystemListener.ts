// import chokidar from 'chokidar';
import { LogStoreClient, MessageMetadata } from '@logsn/client';
import {
	SystemMessage,
	SystemMessageType,
	SystemMessageTypeMap,
} from '@logsn/protocol/src/exports';
import { filter, Subject } from 'rxjs';
import type { Logger } from 'tslog';

import { BroadbandSubscriber } from '../shared/BroadbandSubscriber';
import { MessageMetricsSummary } from '../shared/MessageMetricsSummary';

export type SystemMessageFromStream<T extends SystemMessage = SystemMessage> = {
	message: T;
	metadata: MessageMetadata;
};

export class SystemListener {
	// private _latestTimestamp: number;
	private _startTimestamp: number;
	public messagesStream = new Subject<SystemMessageFromStream>();

	constructor(
		private readonly _client: LogStoreClient,
		private readonly _systemSubscriber: BroadbandSubscriber,
		private readonly messageMetricsSummary: MessageMetricsSummary,
		private readonly logger: Logger
	) {}

	public get startTimestamp() {
		return this._startTimestamp;
	}

	public get client() {
		return this._client;
	}

	public async start(): Promise<void> {
		try {
			this.logger.info('Starting SystemListener ...');
			await this._systemSubscriber.subscribe((content, metadata) =>
				setImmediate(() => this.onMessage(content, metadata))
			);

			// await this._systemRecovery.start(this.onSystemMessage.bind(this));

			// Store a timestamp for when the listener starts so that the Node must have a timestamp < bundle_start_key to pariticpate.
			this._startTimestamp = Date.now();
		} catch (e) {
			this.logger.error(`Unexpected error starting listener...`);
			this.logger.error(e);
			throw e; // Fail if there's an issue with listening to data critical to performance of validator.
		}
	}

	public async stop() {
		// await this._systemRecovery.stop();
		await this._systemSubscriber.unsubscribe();
	}

	// public get latestTimestamp() {
	// if (!this._systemRecovery.progress.isComplete) {
	// 	return this._systemRecovery.progress.timestamp;
	// }
	// return Math.max(
	// 	this._latestTimestamp || 0,
	// 	this._systemRecovery.progress.timestamp
	// );
	// }

	private async onMessage(
		content: unknown,
		metadata: MessageMetadata
	): Promise<void> {
		this.messageMetricsSummary.update(content, metadata);

		const systemMessage = SystemMessage.deserialize(content);

		this.messagesStream.next({
			message: systemMessage,
			metadata,
		});
	}

	public static isMsgType<T extends SystemMessageType>(type: T) {
		return (
			msg: SystemMessageFromStream
		): msg is SystemMessageFromStream<SystemMessageTypeMap[T]> => {
			return msg.message.messageType === type;
		};
	}

	public messagesStreamFromType<T extends SystemMessageType>(type: T) {
		return this.messagesStream.pipe(filter(SystemListener.isMsgType(type)));
	}
}
