import { MessageMetadata } from '@logsn/client';
import {
	QueryRequest,
	QueryResponse,
	SystemMessage,
	SystemMessageType,
} from '@logsn/protocol';
import { Logger } from '@streamr/utils';
import { Signer } from 'ethers';

import { BroadbandPublisher } from '../../shared/BroadbandPublisher';
import { BroadbandSubscriber } from '../../shared/BroadbandSubscriber';
import { Heartbeat } from './Heartbeat';
import { LogStore } from './LogStore';

const logger = new Logger(module);

export class QueryResponseManager {
	private logStore?: LogStore;

	private pendingPrimaryNodeQueryResponses = new Map<string, QueryResponse>();
	private pendingOwnQueryResponsesVerificationsToPropagate = new Map<
		string,
		QueryResponse
	>();

	constructor(
		private readonly publisher: BroadbandPublisher,
		private readonly subscriber: BroadbandSubscriber,
		private readonly heartbeat: Heartbeat,
		private readonly signer: Signer
	) {
		//
	}

	public async start(logStore: LogStore) {
		this.logStore = logStore;

		await this.subscriber.subscribe(this.onMessage.bind(this));
	}

	public async stop() {
		await this.subscriber.unsubscribe();
	}

	private async onMessage(content: unknown, metadata: MessageMetadata) {
		const systemMessage = SystemMessage.deserialize(content);

		if (systemMessage.messageType !== SystemMessageType.QueryResponse) {
			return;
		}

		const queryResponse = systemMessage as QueryResponse;
		logger.debug(
			'Received QueryResponse, content: %s metadata: %s',
			content,
			metadata
		);

		this.checkAndAddPrimaryNodeQueryResponse(queryResponse);
	}

	public checkAndAddPrimaryNodeQueryResponse(queryResponse: QueryResponse) {
		if (this.isPrimaryNodeResponse(queryResponse)) {
			this.pendingPrimaryNodeQueryResponses.set(
				queryResponse.requestId,
				queryResponse
			);
		}
	}

	private addOwnQueryResponse(queryResponse: QueryResponse) {
		this.pendingOwnQueryResponsesVerificationsToPropagate.set(
			queryResponse.requestId,
			queryResponse
		);
	}

	public checkIfPropagateIsNeeded({
		primaryNodeQueryResponse,
		ownQueryResponse,
	}: {
		primaryNodeQueryResponse: QueryResponse;
		ownQueryResponse: QueryResponse;
	}): boolean {
		throw new Error('not implemented');
	}

	public waitForConsensus(queryRequest: QueryRequest) {}

	private isPrimaryNodeResponse(queryResponse: QueryResponse): boolean {}

	public publishQueryResponse(queryResponse: QueryResponse) {
		this.addOwnQueryResponse(queryResponse);
		return this.publisher.publish(queryResponse.serialize());
	}
}
