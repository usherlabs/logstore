import { MessageMetadata } from '@logsn/client';
import {
	QueryPropagate,
	QueryResponse,
	SystemMessage,
	SystemMessageType,
} from '@logsn/protocol';

import { BroadbandPublisher } from '../../shared/BroadbandPublisher';
import { BroadbandSubscriber } from '../../shared/BroadbandSubscriber';
import { LogStore } from './LogStore';

type RequestId = string;

export class PropagationServer {
	//TODO: Set a TTL and clean the Responses by a timer
	private primaryResponses: Map<RequestId, QueryResponse>;
	private foreignResponses: Map<RequestId, QueryResponse>;

	constructor(
		private readonly logStore: LogStore,
		private readonly publisher: BroadbandPublisher,
		private readonly subscriber: BroadbandSubscriber
	) {
		this.primaryResponses = new Map<RequestId, QueryResponse>();
		this.foreignResponses = new Map<RequestId, QueryResponse>();
	}

	public async start() {
		await this.subscriber.subscribe(this.onMessage.bind(this));
	}

	public async stop() {
		await this.subscriber.unsubscribe();
	}

	public async setForeignResponse(queryResponse: QueryResponse) {
		this.foreignResponses.set(queryResponse.requestId, queryResponse);
		await this.propagate(queryResponse.requestId);
	}

	private async onMessage(content: unknown, metadata: MessageMetadata) {
		const systemMessage = SystemMessage.deserialize(content);
		if (systemMessage.messageType !== SystemMessageType.QueryResponse) {
			return;
		}

		const queryResponse = systemMessage as QueryResponse;
		if (queryResponse.requestPublisherId === metadata.publisherId) {
			this.primaryResponses.set(queryResponse.requestId, queryResponse);

			await this.propagate(queryResponse.requestId);
		}
	}

	private async propagate(requestId: RequestId) {
		const primaryResponse = this.primaryResponses.get(requestId);
		const foreignResponse = this.foreignResponses.get(requestId);

		if (!primaryResponse || !foreignResponse) {
			return;
		}

		this.primaryResponses.delete(requestId);
		this.foreignResponses.delete(requestId);

		// Determine missing messages in the PrimaryResponse
		const messageIds: string[] = [];
		foreignResponse.hashMap.forEach((_messageHash, messageId) => {
			if (!primaryResponse.hashMap.has(messageId)) {
				messageIds.push(messageId);
			}
		});

		// Exit if nothing to propagate
		if (messageIds.length === 0) {
			return;
		}

		// Read the messages from the LogStore
		const messages: [string, string][] = [];
		for (const messageId of messageIds) {
			const message = this.logStore.requestPayloadByMessageId(messageId);
			messages.push([messageId, message]);
		}

		const queryPropagate = new QueryPropagate({
			requestId,
			requestPublisherId: primaryResponse.requestPublisherId,
			payload: messages,
		});

		await this.publisher.publish(queryPropagate.serialize());
	}
}
