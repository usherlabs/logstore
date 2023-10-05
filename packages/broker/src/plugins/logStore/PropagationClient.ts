import { EthereumAddress, MessageMetadata } from '@logsn/client';
import {
	QueryPropagate,
	QueryRequest,
	QueryResponse,
	SystemMessage,
	SystemMessageType,
} from '@logsn/protocol';
import { StreamMessage } from '@streamr/protocol';

import { BroadbandPublisher } from '../../shared/BroadbandPublisher';
import { BroadbandSubscriber } from '../../shared/BroadbandSubscriber';
import { Heartbeat } from './Heartbeat';
import { LogStore } from './LogStore';

type RequestId = string;

const TIMEOUT = 5 * 1000;
const RESPONSES_THRESHOLD = 1.0;

class QueryState {
	private primaryResponseHashMap: Map<string, string>;
	private awaitingMessageIds: Map<string, string>;
	private respondedBrokers: Map<EthereumAddress, boolean>;

	constructor(queryResponse: QueryResponse, onlineBrokers: EthereumAddress[]) {
		this.primaryResponseHashMap = queryResponse.hashMap;
		this.awaitingMessageIds = new Map<string, string>();
		this.respondedBrokers = new Map<EthereumAddress, boolean>();

		for (const onlineBroker of onlineBrokers) {
			if (onlineBroker != queryResponse.requestPublisherId) {
				this.respondedBrokers.set(onlineBroker, false);
			}
		}
	}

	public onResponse(queryResponse: QueryResponse, metadata: MessageMetadata) {
		for (const [messageId, messageHash] of queryResponse.hashMap) {
			if (!this.primaryResponseHashMap.has(messageId)) {
				this.awaitingMessageIds.set(messageId, messageHash);
			}
		}

		this.respondedBrokers.set(metadata.publisherId, true);
	}

	public onPropagate(queryPropagate: QueryPropagate) {
		const messages: [string, string][] = [];

		for (const [messageId, content] of queryPropagate.payload) {
			if (this.awaitingMessageIds.has(messageId)) {
				messages.push([messageId, content]);
				this.awaitingMessageIds.delete(messageId);
			}
		}

		return messages;
	}

	public get isReady() {
		if (this.respondedBrokers.size === 0) {
			return true;
		}

		let count = 0;
		for (const responded of this.respondedBrokers.values()) {
			if (responded) {
				count++;
			}
		}

		const percentResponded = count / this.respondedBrokers.size;

		return (
			percentResponded >= RESPONSES_THRESHOLD &&
			this.awaitingMessageIds.size === 0
		);
	}
}

export class PropagationClient {
	private readonly queryStates: Map<RequestId, QueryState>;
	private readonly queryCallbacks: Map<RequestId, () => void>;

	constructor(
		private readonly logStore: LogStore,
		private readonly heartbeat: Heartbeat,
		private readonly publisher: BroadbandPublisher,
		private readonly subscriber: BroadbandSubscriber
	) {
		this.queryStates = new Map<RequestId, QueryState>();
		this.queryCallbacks = new Map<RequestId, () => void>();
	}

	public async start() {
		await this.subscriber.subscribe(this.onMessage.bind(this));
	}

	public async stop() {
		await this.subscriber.unsubscribe();
	}

	public async propagate(queryRequest: QueryRequest) {
		await this.publisher.publish(queryRequest.serialize());

		let timeout: NodeJS.Timeout;

		return Promise.race([
			new Promise((_, reject) => {
				timeout = setTimeout(() => {
					this.clean(queryRequest.requestId);
					reject('Propagation timeout');
				}, TIMEOUT);
			}),
			new Promise<void>((resolve) => {
				this.queryCallbacks.set(queryRequest.requestId, () => {
					clearTimeout(timeout);
					resolve();
				});
			}),
		]);
	}

	public setPrimaryResponse(queryResponse: QueryResponse) {
		const queryState = new QueryState(
			queryResponse,
			this.heartbeat.onlineBrokers
		);

		this.queryStates.set(queryResponse.requestId, queryState);

		this.finishIfReady(queryState, queryResponse.requestId);
	}

	private onMessage(content: unknown, metadata: MessageMetadata) {
		const systemMessage = SystemMessage.deserialize(content);

		switch (systemMessage.messageType) {
			case SystemMessageType.QueryResponse:
				this.onQueryResponse(systemMessage as QueryResponse, metadata);
				break;
			case SystemMessageType.QueryPropagate:
				this.onQueryPropagate(systemMessage as QueryPropagate, metadata);
				break;
		}
	}

	private async onQueryResponse(
		queryResponse: QueryResponse,
		metadata: MessageMetadata
	) {
		if (queryResponse.requestPublisherId === metadata.publisherId) {
			return;
		}

		const queryState = this.queryStates.get(queryResponse.requestId);
		if (!queryState) {
			return;
		}

		queryState.onResponse(queryResponse, metadata);

		this.finishIfReady(queryState, queryResponse.requestId);
	}

	private async onQueryPropagate(
		queryPropagate: QueryPropagate,
		metadata: MessageMetadata
	) {
		if (queryPropagate.requestPublisherId === metadata.publisherId) {
			return;
		}

		const queryState = this.queryStates.get(queryPropagate.requestId);
		if (!queryState) {
			return;
		}

		const messages = queryState.onPropagate(queryPropagate);

		for (const [_messageId, messageStr] of messages) {
			const message = StreamMessage.deserialize(messageStr);
			await this.logStore.store(message);
		}

		this.finishIfReady(queryState, queryPropagate.requestId);
	}

	private finishIfReady(queryState: QueryState, requestId: RequestId) {
		if (queryState.isReady) {
			const callback = this.queryCallbacks.get(requestId);

			this.clean(requestId);
			if (callback) {
				callback();
			}
		}
	}

	private clean(requestId: RequestId) {
		this.queryStates.delete(requestId);
		this.queryCallbacks.delete(requestId);
	}
}
