import { EthereumAddress, MessageMetadata, verify } from '@logsn/client';
import {
	QueryPropagate,
	QueryRequest,
	QueryResponse,
	SystemMessage,
	SystemMessageType,
} from '@logsn/protocol';
import { createSignaturePayload, StreamMessage } from '@streamr/protocol';

import { BroadbandSubscriber } from '../../shared/BroadbandSubscriber';
import { Heartbeat } from './Heartbeat';
import { LogStore } from './LogStore';

type RequestId = string;

const TIMEOUT = 30 * 1000;
const RESPONSES_THRESHOLD = 1.0;

class QueryPropagationState {
	private primaryResponseHashMap: Map<string, string>;
	private awaitingMessageIds: Map<string, string>;
	public respondedBrokers: Map<EthereumAddress, boolean>;

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

	public onForeignQueryResponse(
		queryResponse: QueryResponse,
		metadata: MessageMetadata
	) {
		// We add here the messageIds that are not in the primary response
		for (const [messageId, messageHash] of queryResponse.hashMap) {
			if (!this.primaryResponseHashMap.has(messageId)) {
				this.awaitingMessageIds.set(messageId, messageHash);
			}
		}

		this.respondedBrokers.set(metadata.publisherId, true);
	}

	public onPropagate(queryPropagate: QueryPropagate) {
		const messages: [string, string][] = [];

		for (const [messageIdStr, serializedMessage] of queryPropagate.payload) {
			if (this.awaitingMessageIds.has(messageIdStr)) {
				const isVerified = this.verifyPropagatedMessage(serializedMessage);
				if (isVerified) {
					messages.push([messageIdStr, serializedMessage]);
				}

				// we delete the message from the awaiting list regardless of verification result
				this.awaitingMessageIds.delete(messageIdStr);
			}
		}

		return messages;
	}

	private verifyPropagatedMessage(serializedMessage: string) {
		const message = StreamMessage.deserialize(serializedMessage);
		const messageId = message.getMessageID();
		const prevMsgRef = message.getPreviousMessageRef() ?? undefined;
		const newGroupKey = message.getNewGroupKey() ?? undefined;
		const serializedContent = message.getSerializedContent();

		const messagePayload = createSignaturePayload({
			messageId,
			serializedContent,
			prevMsgRef,
			newGroupKey,
		});

		const messagePublisherAddress = message.getPublisherId();
		const messageSignature = message.signature;

		return verify(messagePublisherAddress, messagePayload, messageSignature);
	}

	/**
	 * We know if we are ready if we have received responses from sufficient brokers
	 * that previously said that this query was missing messages
	 */
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

export class PropagationResolver {
	private readonly queryPropagationStateMap: Map<
		RequestId,
		QueryPropagationState
	>;
	private readonly queryCallbacks: Map<
		RequestId,
		(participatedNodes: string[]) => void
	>;

	constructor(
		private readonly logStore: LogStore,
		private readonly heartbeat: Heartbeat,
		private readonly subscriber: BroadbandSubscriber
	) {
		this.queryPropagationStateMap = new Map<RequestId, QueryPropagationState>();
		this.queryCallbacks = new Map<RequestId, () => void>();
	}

	public async start() {
		await this.subscriber.subscribe(this.onMessage.bind(this));
	}

	public async stop() {
		await this.subscriber.unsubscribe();
	}

	public async waitForPropagateResolution(queryRequest: QueryRequest) {
		let timeout: NodeJS.Timeout;

		return Promise.race([
			new Promise<never>((_, reject) => {
				timeout = setTimeout(() => {
					this.clean(queryRequest.requestId);
					reject('Propagation timeout');
				}, TIMEOUT);
			}),
			new Promise<{ participatingNodes: string[] }>((resolve) => {
				this.queryCallbacks.set(
					queryRequest.requestId,
					(participatingNodes) => {
						clearTimeout(timeout);
						resolve({ participatingNodes });
					}
				);
			}),
		]);
	}

	private onMessage(content: unknown, metadata: MessageMetadata) {
		const systemMessage = SystemMessage.deserialize(content);

		if (systemMessage.messageType !== SystemMessageType.QueryPropagate) {
			return;
		}

		this.onQueryPropagate(systemMessage as QueryPropagate, metadata);
	}

	/**
	 * These are responses produced by this own node running this code, which happens
	 * to be the primary node handling the request.
	 * @param queryResponse
	 */
	public setPrimaryResponse(queryResponse: QueryResponse) {
		const queryState = new QueryPropagationState(
			queryResponse,
			this.heartbeat.onlineBrokers
		);

		this.queryPropagationStateMap.set(queryResponse.requestId, queryState);

		// it may be ready if there are no other brokers responding here
		this.finishIfReady(queryState, queryResponse.requestId);
	}

	/**
	 * These are responses produced by other nodes, trying to see if my response
	 * has any missing messages
	 * @param queryResponse
	 * @param metadata
	 */
	public async setForeignResponse(
		queryResponse: QueryResponse,
		metadata: MessageMetadata
	) {
		const queryState = this.queryPropagationStateMap.get(
			queryResponse.requestId
		);
		if (!queryState) {
			return;
		}

		queryState.onForeignQueryResponse(queryResponse, metadata);

		// May be ready if this response was the last one missing, and it produced
		// no propagation requirement
		this.finishIfReady(queryState, queryResponse.requestId);
	}

	private async onQueryPropagate(
		queryPropagate: QueryPropagate,
		metadata: MessageMetadata
	) {
		if (queryPropagate.requestPublisherId === metadata.publisherId) {
			return;
		}

		const queryState = this.queryPropagationStateMap.get(
			queryPropagate.requestId
		);
		if (!queryState) {
			return;
		}

		const messages = queryState.onPropagate(queryPropagate);

		for (const [_messageId, messageStr] of messages) {
			const message = StreamMessage.deserialize(messageStr);
			await this.logStore.store(message);
		}

		// May be ready if this propagation was the last one missing.
		this.finishIfReady(queryState, queryPropagate.requestId);
	}

	// It may be ready if
	// - we received all necessary responses from sufficient brokers
	// - we have no more missing messages waiting for propagation.
	private finishIfReady(
		queryState: QueryPropagationState,
		requestId: RequestId
	) {
		if (queryState.isReady) {
			const callback = this.queryCallbacks.get(requestId);

			this.clean(requestId);
			if (callback) {
				callback(Array.from(queryState.respondedBrokers.keys()));
			}
		}
	}

	private clean(requestId: RequestId) {
		this.queryPropagationStateMap.delete(requestId);
		this.queryCallbacks.delete(requestId);
	}
}
