import {
	EthereumAddress,
	LogStoreClient,
	MessageMetadata,
	Stream,
} from '@logsn/client';
import {
	RollCallRequest,
	RollCallResponse,
	SystemMessage,
	SystemMessageType,
} from '@logsn/protocol';
import { v4 as uuid } from 'uuid';

import { StreamPublisher } from '../../shared/StreamPublisher';
import { StreamSubscriber } from '../../shared/StreamSubscriber';

const ROLLCALL_ROUND_MS = 10 * 1000;
const ROLLCALL_ROUND_SPREAD_MS = 5 * 1000;

export class RollCall {
	private streamSubscriber: StreamSubscriber;
	private roundTimeout?: NodeJS.Timeout;
	private requestId?: string;
	private responses: Map<EthereumAddress, number> = new Map();

	constructor(
		private readonly client: LogStoreClient,
		private readonly systemStream: Stream,
		private readonly streamPublisher: StreamPublisher
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

		this.resetRoundTimeout();
	}

	public async stop() {
		if (this.roundTimeout) {
			clearTimeout(this.roundTimeout);
			this.roundTimeout = undefined;
		}
		await this.streamSubscriber.unsubscribe();
	}

	public get aliveBrokers() {
		const result = [];
		const threshold = Date.now() - ROLLCALL_ROUND_MS;
		for (const [address, time] of this.responses) {
			if (time > threshold) {
				result.push(address);
			}
		}

		return result;
	}

	private resetRoundTimeout() {
		if (this.roundTimeout) {
			clearTimeout(this.roundTimeout);
		}

		const roundTimeoutMs =
			ROLLCALL_ROUND_MS - Math.round(ROLLCALL_ROUND_SPREAD_MS * Math.random());
		this.roundTimeout = setTimeout(
			this.onRoundTimeout.bind(this),
			roundTimeoutMs
		);
	}

	private async onRoundTimeout() {
		this.resetRoundTimeout();
		this.requestId = uuid();

		const rollCallRequest = new RollCallRequest({ requestId: this.requestId });
		await this.streamPublisher.publish(rollCallRequest.serialize());
	}

	private async onMessage(message: unknown, metadata: MessageMetadata) {
		const systemMessage = SystemMessage.deserialize(message);
		switch (systemMessage.messageType) {
			case SystemMessageType.RollCallRequest: {
				this.resetRoundTimeout();

				const rollCallRequest = systemMessage as RollCallRequest;
				this.requestId = rollCallRequest.requestId;

				const rollCallResponse = new RollCallResponse({
					requestId: this.requestId,
				});
				await this.streamPublisher.publish(rollCallResponse.serialize());
				break;
			}
			case SystemMessageType.RollCallResponse: {
				const rollCallResponse = systemMessage as RollCallResponse;
				if (rollCallResponse.requestId === this.requestId) {
					this.responses.set(metadata.publisherId, Date.now());
				}
				break;
			}
		}
	}
}