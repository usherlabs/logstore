import { SystemMessage, SystemMessageType } from '@logsn/protocol';
import { Logger } from '@streamr/utils';
import { MessageMetadata } from 'streamr-client';

import { BroadbandSubscriber } from '../../shared/BroadbandSubscriber';
import { KyvePool } from './KyvePool';

const logger = new Logger(module);

const CACHE_MESSAGE_TYPES = [
	SystemMessageType.QueryRequest,
	SystemMessageType.QueryResponse,
	SystemMessageType.QueryPropagate,
	SystemMessageType.ProofOfReport,
];

const DEFAULT_SRINK_INTERVAL = 2 * 60 * 1000;

export class SystemCache {
	private shrinkTimeout?: NodeJS.Timeout;

	// TODO: We may need to replace this in-memory cache with LMDB in the future.
	private records: {
		message: SystemMessage;
		metadata: MessageMetadata;
	}[] = [];

	constructor(
		private readonly subscriber: BroadbandSubscriber,
		private readonly kyvePool: KyvePool
	) {
		//
	}

	public async start() {
		await this.subscriber.subscribe(this.onMessage.bind(this));

		let shrinkTimeout;
		try {
			const kyvePoolData = await this.kyvePool.fetchPoolData();
			shrinkTimeout = kyvePoolData.uploadInterval * 1000;
		} catch (err) {
			logger.warn(`error when trying to get shrink interval for cache: ${err}`);
			shrinkTimeout = DEFAULT_SRINK_INTERVAL;
		}

		await this.resetShrinkTimeout(shrinkTimeout);

		logger.info('Started');
	}

	public async stop() {
		if (this.shrinkTimeout) {
			clearTimeout(this.shrinkTimeout);
			this.shrinkTimeout = undefined;
		}
		await this.subscriber.unsubscribe();
		logger.info('Stopped');
	}

	private async resetShrinkTimeout(ms: number) {
		if (this.shrinkTimeout) {
			clearTimeout(this.shrinkTimeout);
		}

		this.shrinkTimeout = setTimeout(this.onShrinkTimeout.bind(this), ms);
	}

	private async onShrinkTimeout() {
		try {
			const kyvePoolData = await this.kyvePool.fetchPoolData();

			const shrinkTimeout = kyvePoolData.uploadInterval * 1000;
			const shrinkTimestamp = kyvePoolData.currentKey * 1000;

			this.resetShrinkTimeout(shrinkTimeout);
			this.shrink(shrinkTimestamp);
		} catch (err) {
			logger.warn(`error when trying to shrink cache: ${err}`);
		}
	}

	private async onMessage(content: unknown, metadata: MessageMetadata) {
		const systemMessage = SystemMessage.deserialize(content);

		if (CACHE_MESSAGE_TYPES.includes(systemMessage.messageType)) {
			this.records.push({
				message: systemMessage,
				metadata,
			});
		}
	}

	public get(from: number, to?: number) {
		return this.records.filter(
			(record) =>
				record.metadata.timestamp >= from &&
				record.metadata.timestamp < (to || Number.MAX_SAFE_INTEGER)
		);
	}

	private async shrink(timestamp: number) {
		this.records = this.get(timestamp);

		logger.debug('Shrunk', {
			timestamp,
			records: this.records.length,
		});
	}
}
