import { MessageMetadata } from '@logsn/client';
import {
	QueryResponse,
	SystemMessage,
	SystemMessageType,
} from '@logsn/protocol';
import { EthereumAddress, Logger } from '@streamr/utils';

import { BroadbandPublisher } from '../../shared/BroadbandPublisher';
import { BroadbandSubscriber } from '../../shared/BroadbandSubscriber';
import { PropagationDispatcher } from './PropagationDispatcher';
import { PropagationResolver } from './PropagationResolver';

const logger = new Logger(module);

export class QueryResponseManager {
	private clientId?: EthereumAddress;

	constructor(
		private readonly publisher: BroadbandPublisher,
		private readonly subscriber: BroadbandSubscriber,
		private readonly propagationResolver: PropagationResolver,
		private readonly propagationDispatcher: PropagationDispatcher
	) {
		//
	}

	public async start(clientId: EthereumAddress) {
		this.clientId = clientId;
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

		if (queryResponse.requestPublisherId === metadata.publisherId) {
			// Received QueryResponses produced by the same node that issued the QueryRequest (i.e. primary node),
			// useful to add to the dispatcher as we want to compare to our own responses
			// when we are the foreign node to dispatch QueryPropagate if necessary
			this.propagationDispatcher.setPrimaryResponse(queryResponse);
		} else {
			// Received QueryResponses produced by other nodes, useful to add to the resolver
			// as we want to compare to our own responses when we are the primary node
			// and we need to know if we have received all responses and propagations
			// accordingly
			this.propagationResolver.setForeignResponse(queryResponse, metadata);
		}
	}

	public async publishQueryResponse(queryResponse: QueryResponse) {
		if (queryResponse.requestPublisherId === this.clientId) {
			// We are now responding to our own QueryRequest, so we need to add it to the resolver
			// as we may need to wait for other nodes to respond and wait their propagations
			this.propagationResolver.setPrimaryResponse(queryResponse);
		} else {
			// We are responding to a QueryRequest issued by another node, so we need to add it to the dispatcher
			// as we will need to compare this to the response we receive from the primary node
			await this.propagationDispatcher.setForeignResponse(queryResponse);
		}
		return this.publisher.publish(queryResponse.serialize());
	}
}
