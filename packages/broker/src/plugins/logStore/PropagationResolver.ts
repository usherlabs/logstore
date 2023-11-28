import { EthereumAddress, MessageMetadata, verify } from '@logsn/client';
import {
	QueryPropagate,
	QueryRequest,
	QueryResponse,
	SystemMessage,
	SystemMessageType,
} from '@logsn/protocol';
import { createSignaturePayload, StreamMessage } from '@streamr/protocol';
import { Logger, toEthereumAddress } from '@streamr/utils';
import { firstValueFrom, type Observable } from 'rxjs';

import { BroadbandSubscriber } from '../../shared/BroadbandSubscriber';
import { Heartbeat } from './Heartbeat';
import { LogStore } from './LogStore';

const logger = new Logger(module);

type RequestId = string;
const TIMEOUT = 30 * 1000;
const RESPONSES_THRESHOLD = 1.0;

class QueryPropagationState {
	private primaryResponseHashMap: Map<string, string> | null = null;
	private awaitingMessageIds: Map<string, string>;
	public brokersResponseState: Map<EthereumAddress, boolean>;
	private foreignResponseBuffer: [QueryResponse, MessageMetadata][] = [];
	private propagateBuffer: QueryPropagate[] = [];
	public messagesReadyToBeStored: [string, string][] = [];

	constructor(onlineBrokers: EthereumAddress[]) {
		this.awaitingMessageIds = new Map<string, string>();
		this.brokersResponseState = new Map<EthereumAddress, boolean>(
			onlineBrokers.map((broker) => [broker, false])
		);
	}

	public onPrimaryQueryResponse(primaryResponse: QueryResponse) {
		// this should happen only once
		if (this.primaryResponseHashMap) {
			logger.error('Primary response already set');
			return;
		}

		this.brokersResponseState.set(
			toEthereumAddress(primaryResponse.requestPublisherId),
			true
		);

		this.primaryResponseHashMap = primaryResponse.hashMap;
		this.foreignResponseBuffer.forEach((args) =>
			this.onForeignQueryResponse(...args)
		);
		this.propagateBuffer.forEach((queryPropagate) =>
			this.onPropagate(queryPropagate)
		);
	}

	public onForeignQueryResponse(
		queryResponse: QueryResponse,
		metadata: MessageMetadata
	) {
		if (!this.primaryResponseHashMap) {
			this.foreignResponseBuffer.push([queryResponse, metadata]);
			return;
		}

		// We add here the messageIds that are not in the primary response
		for (const [messageId, messageHash] of queryResponse.hashMap) {
			if (!this.primaryResponseHashMap.has(messageId)) {
				this.awaitingMessageIds.set(messageId, messageHash);
			}
		}

		this.brokersResponseState.set(metadata.publisherId, true);
	}

	public onPropagate(queryPropagate: QueryPropagate) {
		if (!this.primaryResponseHashMap) {
			this.propagateBuffer.push(queryPropagate);
			// we don't have the primary response yet, so we can't verify the propagated messages and store them
			return;
		}
		for (const [messageIdStr, serializedMessage] of queryPropagate.payload) {
			if (this.awaitingMessageIds.has(messageIdStr)) {
				const isVerified = this.verifyPropagatedMessage(serializedMessage);
				if (isVerified) {
					this.messagesReadyToBeStored.push([messageIdStr, serializedMessage]);
				}

				// we delete the message from the awaiting list regardless of verification result
				this.awaitingMessageIds.delete(messageIdStr);
			}
		}
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
		// this means there's no one identified as online. This broker is alone and there's no chance to receive a propagate.
		if (this.brokersResponseState.size === 0) {
			return true;
		}

		const respondedCount = Array.from(
			this.brokersResponseState.values()
		).filter(Boolean).length;
		const percentResponded = respondedCount / this.brokersResponseState.size;

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
		private readonly logStore$: Observable<LogStore>,
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

		// Racing between timeout and finalization of the query
		return Promise.race([
			new Promise<never>((_, reject) => {
				timeout = setTimeout(() => {
					logger.warn(
						'Propagation timeout on request %s',
						queryRequest.requestId
					);
					logger.debug(
						'Current state of the query on timeout: %s',
						JSON.stringify(
							this.queryPropagationStateMap.get(queryRequest.requestId)
						)
					);
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
		const queryState = this.getOrCreateQueryState(queryResponse.requestId);
		queryState.onPrimaryQueryResponse(queryResponse);

		// it may be ready if there are no other brokers responding here
		this.finishIfReady(queryState, queryResponse.requestId);
	}

	private getOrCreateQueryState(requestId: RequestId) {
		const queryState =
			this.queryPropagationStateMap.get(requestId) ??
			new QueryPropagationState(this.heartbeat.onlineBrokers);
		this.queryPropagationStateMap.set(requestId, queryState);
		return queryState;
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
		const queryState = this.getOrCreateQueryState(queryResponse.requestId);
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

		queryState.onPropagate(queryPropagate);
		// we copy, so any async operation don't cause racing conditions
		// making we store twice in meanwhile
		const messagesToBeStored = [...queryState.messagesReadyToBeStored];
		// we just don't want to process them twice
		queryState.messagesReadyToBeStored = [];

		for (const [_messageId, messageStr] of messagesToBeStored) {
			const message = StreamMessage.deserialize(messageStr);
			const logStore = await firstValueFrom(this.logStore$);
			await logStore.store(message);
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
				callback(Array.from(queryState.brokersResponseState.keys()));
			}
		}
	}

	private clean(requestId: RequestId) {
		this.queryPropagationStateMap.delete(requestId);
		this.queryCallbacks.delete(requestId);
	}
}
