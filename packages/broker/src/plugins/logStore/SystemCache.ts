import { LogStoreClient, MessageMetadata, Stream } from '@logsn/client';
import { SystemMessage, SystemMessageType } from '@logsn/protocol';
import { Logger } from '@streamr/utils';

import { StreamSubscriber } from '../../shared/StreamSubscriber';
import { KyvePool } from './KyvePool';

const logger = new Logger(module);

const CACHE_MESSAGE_TYPES = [
	SystemMessageType.QueryRequest,
	SystemMessageType.QueryResponse,
	SystemMessageType.ProofOfMessageStored,
	SystemMessageType.ProofOfReport,
];

export class SystemCache {
	private streamSubscriber: StreamSubscriber;
	private shrinkTimeout?: NodeJS.Timeout;

	private records: {
		message: unknown;
		metadata: MessageMetadata;
	}[] = [];

	constructor(
		private readonly client: LogStoreClient,
		private readonly systemStream: Stream,
		private readonly kyvePool: KyvePool
	) {
		this.streamSubscriber = new StreamSubscriber(
			this.client,
			this.systemStream
		);
	}

	public async start() {
		await this.streamSubscriber.subscribe(
			async (content: unknown, metadata: MessageMetadata) =>
				await this.onMessage(content, metadata)
		);

		const kyvePoolData = await this.kyvePool.getData();
		const shrinkTimeout = kyvePoolData.uploadInterval * 1000;

		await this.resetShrinkTimeout(shrinkTimeout);
	}

	public async stop() {
		if (this.shrinkTimeout) {
			clearTimeout(this.shrinkTimeout);
			this.shrinkTimeout = undefined;
		}
		await this.streamSubscriber.unsubscribe();
	}

	private async resetShrinkTimeout(ms: number) {
		if (this.shrinkTimeout) {
			clearTimeout(this.shrinkTimeout);
		}

		this.shrinkTimeout = setTimeout(this.onShrinkTimeout.bind(this), ms);
	}

	private async onShrinkTimeout() {
		const kyvePoolData = await this.kyvePool.getData();

		const shrinkTimeout = kyvePoolData.uploadInterval * 1000;
		const shrinkTimestamp = kyvePoolData.currentKey * 1000;

		this.resetShrinkTimeout(shrinkTimeout);
		this.shrink(shrinkTimestamp);
	}

	private async onMessage(message: unknown, metadata: MessageMetadata) {
		const systemMessage = SystemMessage.deserialize(message);

		if (CACHE_MESSAGE_TYPES.includes(systemMessage.messageType)) {
			this.records.push({
				message,
				metadata,
			});
		}
	}

	public get(from: number) {
		return this.records.filter((record) => record.metadata.timestamp >= from);
	}

	private async shrink(timestamp: number) {
		this.records = this.get(timestamp);

		logger.info('Shrunk to: %i. Records: %i', timestamp, this.records.length);
	}
}
