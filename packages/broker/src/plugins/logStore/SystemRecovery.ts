import {
	RecoveryComplete,
	RecoveryRequest,
	RecoveryResponse,
	SystemMessage,
	SystemMessageType,
} from '@logsn/protocol';
import { Logger } from '@streamr/utils';
import StreamrClient, {
	MessageMetadata,
	Stream,
	Subscription,
} from 'streamr-client';

import { SystemCache } from './SystemCache';

const INTERVAL = 100;
const PAYLOAD_LIMIT = 50;
const RESPONSE_LIMIT = 5;

const logger = new Logger(module);

export class SystemRecovery {
	private subscription?: Subscription;

	constructor(
		private readonly client: StreamrClient,
		private readonly recoveryStream: Stream,
		private readonly systemStream: Stream,
		private readonly cache: SystemCache
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

	private async onMessage(message: unknown) {
		const systemMessage = SystemMessage.deserialize(message);
		if (systemMessage.messageType !== SystemMessageType.RecoveryRequest) {
			return;
		}

		const recoveryRequest = systemMessage as RecoveryRequest;
		logger.debug('Received RecoveryRequest', {
			recoveryRequest,
		});

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

		let count: number = 0;
		const payload: [SystemMessage, MessageMetadata][] = [];
		for await (const cacheRecord of cacheRecords) {
			payload.push([cacheRecord.message, cacheRecord.metadata]);

			if (payload.length === PAYLOAD_LIMIT) {
				await this.sendResponse(requestId, payload.splice(0));
				await new Promise((resolve) => setTimeout(resolve, INTERVAL));
			}

			if (count === RESPONSE_LIMIT) {
				break;
			}
		}

		if (payload.length > 0) {
			count++;
			await this.sendResponse(requestId, payload);
		}

		await this.sendComplete(requestId, count < RESPONSE_LIMIT);
	}

	private async sendResponse(
		requestId: string,
		payload: [SystemMessage, MessageMetadata][]
	) {
		const recoveryResponse = new RecoveryResponse({
			requestId,
			payload,
		});

		const recoveryResponseSeralized = recoveryResponse.serialize();

		await this.recoveryStream.publish(recoveryResponseSeralized);
		logger.debug('Published RecoveryResponse', {
			requestId: recoveryResponse.requestId,
			seqNum: recoveryResponse.seqNum,
			bytes: recoveryResponseSeralized.length,
		});
	}

	private async sendComplete(requestId: string, isFulfilled: boolean) {
		const recoveryComplete = new RecoveryComplete({
			requestId,
			isFulfilled,
		});

		const recoveryCompleteSeralized = recoveryComplete.serialize();

		await this.recoveryStream.publish(recoveryCompleteSeralized);
		logger.debug('Published RecoveryComplete', {
			requestId: recoveryComplete.requestId,
			seqNum: recoveryComplete.seqNum,
			bytes: recoveryCompleteSeralized.length,
		});
	}
}
