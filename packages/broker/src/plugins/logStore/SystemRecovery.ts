import {
	LogStoreClient,
	MessageMetadata,
	Stream,
	Subscription,
} from '@logsn/client';
import {
	RecoveryComplete,
	RecoveryRequest,
	RecoveryResponse,
	SystemMessage,
	SystemMessageType,
} from '@logsn/protocol';
import { Logger } from '@streamr/utils';

import { MessageMetricsSummary } from '../../shared/MessageMetricsSummary';
import { SystemCache } from './SystemCache';

const INTERVAL = 100;
const PAYLOAD_LIMIT = 50;
const RESPONSE_LIMIT = 5;

const logger = new Logger(module);

export class SystemRecovery {
	private subscription?: Subscription;

	constructor(
		private readonly client: LogStoreClient,
		private readonly recoveryStream: Stream,
		private readonly systemStream: Stream,
		private readonly cache: SystemCache,
		private readonly messageMetricsSummary: MessageMetricsSummary
	) {
		//
	}

	public async start() {
		this.subscription = await this.client.subscribe(
			this.systemStream,
			this.onMessage.bind(this)
		);

		logger.info('Started');
	}

	public async stop() {
		await this.subscription?.unsubscribe();

		logger.info('Stopped');
	}

	private async onMessage(message: unknown, metadata: MessageMetadata) {
		this.messageMetricsSummary.update(message, metadata);
		const systemMessage = SystemMessage.deserialize(message);
		if (systemMessage.messageType !== SystemMessageType.RecoveryRequest) {
			return;
		}

		const recoveryRequest = systemMessage as RecoveryRequest;
		logger.debug(
			'Received RecoveryRequest %s',
			JSON.stringify(recoveryRequest)
		);

		setImmediate(async () => {
			await this.processRequest(
				recoveryRequest.requestId,
				recoveryRequest.from,
				recoveryRequest.to
			);
		});
	}

	private async processRequest(requestId: string, from: number, to: number) {
		const cacheRecords = this.cache.get(from, to);

		let seqNum: number = 0;
		const payload: [SystemMessage, MessageMetadata][] = [];
		for await (const cacheRecord of cacheRecords) {
			payload.push([cacheRecord.message, cacheRecord.metadata]);

			if (payload.length === PAYLOAD_LIMIT) {
				await this.sendResponse(requestId, seqNum++, payload.splice(0));
				await new Promise((resolve) => setTimeout(resolve, INTERVAL));
			}

			if (seqNum === RESPONSE_LIMIT) {
				break;
			}
		}

		if (payload.length > 0) {
			await this.sendResponse(requestId, seqNum++, payload);
		}

		await this.sendComplete(requestId, seqNum, seqNum < RESPONSE_LIMIT);
	}

	private async sendResponse(
		requestId: string,
		seqNum: number,
		payload: [SystemMessage, MessageMetadata][]
	) {
		const recoveryResponse = new RecoveryResponse({
			requestId,
			seqNum,
			payload,
		});

		const recoveryResponseSeralized = recoveryResponse.serialize();

		await this.recoveryStream.publish(recoveryResponseSeralized);
		logger.debug(
			'Published RecoveryResponse %s',
			JSON.stringify({
				requestId: recoveryResponse.requestId,
				seqNum: recoveryResponse.seqNum,
				bytes: recoveryResponseSeralized.length,
			})
		);
	}

	private async sendComplete(
		requestId: string,
		seqNum: number,
		isFulfilled: boolean
	) {
		const recoveryComplete = new RecoveryComplete({
			requestId,
			seqNum,
			isFulfilled,
		});

		const recoveryCompleteSeralized = recoveryComplete.serialize();

		await this.recoveryStream.publish(recoveryCompleteSeralized);
		logger.debug(
			'Published RecoveryComplete %s',
			JSON.stringify({
				requestId: recoveryComplete.requestId,
				seqNum: recoveryComplete.seqNum,
				bytes: recoveryCompleteSeralized.length,
			})
		);
	}
}
