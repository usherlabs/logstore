import { QueryPropagate, QueryResponse } from '@logsn/protocol';

import { BroadbandPublisher } from '../../shared/BroadbandPublisher';
import { LogStore } from './LogStore';

type RequestId = string;

export class PropagationDispatcher {
	//TODO: Set a TTL and clean the Responses by a timer
	private primaryResponses: Map<RequestId, QueryResponse>;
	private foreignResponses: Map<RequestId, QueryResponse>;
	private _logStore: LogStore | undefined;

	constructor(private readonly publisher: BroadbandPublisher) {
		this.primaryResponses = new Map<RequestId, QueryResponse>();
		this.foreignResponses = new Map<RequestId, QueryResponse>();
	}

	public start(logStore: LogStore) {
		this._logStore = logStore;
	}

	private get logStore(): LogStore {
		if (!this._logStore) {
			throw new Error('LogStore not initialized');
		}
		return this._logStore;
	}

	/**
	 * These are responses produced by the node running this code, when receiving requests
	 * from primary nodes.
	 * @param queryResponse
	 */
	public async setForeignResponse(queryResponse: QueryResponse) {
		this.foreignResponses.set(queryResponse.requestId, queryResponse);
		await this.checkAndDispatchPropagate(queryResponse.requestId);
	}

	/**
	 * Responses produced by the same node that issued the QueryRequest.
	 * @param queryResponse
	 */
	public async setPrimaryResponse(queryResponse: QueryResponse) {
		this.primaryResponses.set(queryResponse.requestId, queryResponse);
		await this.checkAndDispatchPropagate(queryResponse.requestId);
	}

	private async checkAndDispatchPropagate(requestId: RequestId) {
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
			const message = this.logStore.requestByMessageId(messageId).read();
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
