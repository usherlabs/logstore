import { LogStoreClient, MessageMetadata, Stream } from '@logsn/client';
import {
	RecoveryComplete,
	RecoveryRequest,
	RecoveryResponse,
	SystemMessage,
	SystemMessageType,
} from '@logsn/protocol';
import { Logger } from '@streamr/utils';

import { StreamPublisher } from '../../shared/StreamPublisher';
import { StreamSubscriber } from '../../shared/StreamSubscriber';
import { KyvePool } from './KyvePool';
import { SystemCache } from './SystemCache';

const PAYLOAD_LIMIT = 100;

const logger = new Logger(module);

export class SystemRecovery {
	private readonly streamSubscriber: StreamSubscriber;

	constructor(
		private readonly client: LogStoreClient,
		private readonly systemStream: Stream,
		private readonly streamPublisher: StreamPublisher,
		private readonly systemCache: SystemCache,
		private readonly kyvePool: KyvePool
	) {
		this.streamSubscriber = new StreamSubscriber(
			this.client,
			this.systemStream
		);
	}

	public async start() {
		await this.streamSubscriber.subscribe(this.onMessage.bind(this));
	}

	public async stop() {
		await this.streamSubscriber.unsubscribe();
	}

	private async onMessage(message: unknown) {
		const systemMessage = SystemMessage.deserialize(message);
		if (systemMessage.messageType !== SystemMessageType.RecoveryRequest) {
			return;
		}

		const recoveryRequest = systemMessage as RecoveryRequest;
		logger.trace(
			'Received RecoveryRequest: %s',
			JSON.stringify(recoveryRequest)
		);

		setImmediate(async () => {
			await this.processRequet(recoveryRequest.requestId);
		});
	}

	private async processRequet(requestId: string) {
		const kyvePoolData = await this.kyvePool.getData();
		const from = kyvePoolData.currentKey * 1000;
		const cacheRecords = this.systemCache.get(from);

		const payload: [SystemMessage, MessageMetadata][] = [];
		for await (const cacheRecord of cacheRecords) {
			payload.push([cacheRecord.message, cacheRecord.metadata]);

			if (payload.length === PAYLOAD_LIMIT) {
				await this.sendResponse(requestId, payload.splice(0));
			}
		}

		if (payload.length > 0) {
			await this.sendResponse(requestId, payload);
		}

		const recoveryComplete = new RecoveryComplete({ requestId });
		await this.streamPublisher.publish(recoveryComplete.serialize());
		logger.trace(
			'Published RecoveryComplete: %s',
			JSON.stringify(recoveryComplete)
		);
	}

	private async sendResponse(
		requestId: string,
		payload: [SystemMessage, MessageMetadata][]
	) {
		const recoveryResponse = new RecoveryResponse({ requestId, payload });

		await this.streamPublisher.publish(recoveryResponse.serialize());
		logger.trace(
			'Published RecoveryResponse: %s',
			JSON.stringify(recoveryResponse)
		);
	}
}
