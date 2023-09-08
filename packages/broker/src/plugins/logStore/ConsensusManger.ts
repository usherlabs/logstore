import { MessageMetadata } from '@logsn/client';
import { LogStoreNodeManager } from '@logsn/contracts';
import {
	QueryRequest,
	QueryResponse,
	SystemMessage,
	SystemMessageType,
} from '@logsn/protocol';
import { Logger } from '@streamr/utils';

import { BroadbandPublisher } from '../../shared/BroadbandPublisher';
import { BroadbandSubscriber } from '../../shared/BroadbandSubscriber';
import { MessageMetricsSummary } from '../../shared/MessageMetricsSummary';
import { Consensus } from './Consensus';

const logger = new Logger(module);

export class ConsensusManager {
	private readonly consensuses: Record<string, Consensus> = {};

	constructor(
		private readonly nodeManager: LogStoreNodeManager,
		private readonly publisher: BroadbandPublisher,
		private readonly subscriber: BroadbandSubscriber,
		private readonly messageMetricsSummary: MessageMetricsSummary
	) {
		//
	}

	public async start() {
		await this.subscriber.subscribe(this.onMessage.bind(this));
	}

	public async stop() {
		await this.subscriber.unsubscribe();
	}

	public async getConsensus(queryRequest: QueryRequest) {
		const awaitingResponses = (await this.nodeManager.totalNodes()).toNumber();

		try {
			const consensus = new Consensus(
				queryRequest.requestId,
				awaitingResponses
			);

			this.consensuses[queryRequest.requestId] = consensus;

			await this.publisher.publish(queryRequest.serialize());
			logger.trace('Published QueryRequest: %s', JSON.stringify(queryRequest));
			return await consensus.wait();
		} finally {
			delete this.consensuses[queryRequest.requestId];
		}
	}

	private onMessage(content: unknown, metadata: MessageMetadata) {
		this.messageMetricsSummary.update(content, metadata);

		const systemMessage = SystemMessage.deserialize(content);
		if (systemMessage.messageType != SystemMessageType.QueryResponse) {
			return;
		}

		const queryResponse = systemMessage as QueryResponse;
		if (!this.consensuses[queryResponse.requestId]) {
			return;
		}

		this.consensuses[queryResponse.requestId].update(
			queryResponse,
			metadata.publisherId
		);

		logger.trace(
			'Received QueryResponse: %s',
			JSON.stringify({
				requestId: queryResponse.requestId,
				publisherId: metadata.publisherId,
				hash: queryResponse.hash,
			})
		);
	}
}