import { MessageMetadata, StreamMessage } from '@logsn/client';
import {
	QueryFromOptions,
	QueryLastOptions,
	QueryRangeOptions,
	QueryRequest,
	QueryResponse,
	QueryType,
	SystemMessage,
	SystemMessageType,
} from '@logsn/protocol';
import { Logger } from '@streamr/utils';
import { Signer } from 'ethers';
import { keccak256 } from 'ethers/lib/utils';
import { Readable } from 'stream';

import { BroadbandPublisher } from '../../shared/BroadbandPublisher';
import { BroadbandSubscriber } from '../../shared/BroadbandSubscriber';
import {
	LogStore,
	MAX_SEQUENCE_NUMBER_VALUE,
	MIN_SEQUENCE_NUMBER_VALUE,
} from './LogStore';

const logger = new Logger(module);

export class QueryRequestHandler {
	private seqNum: number = 0;
	private logStore?: LogStore;

	constructor(
		private readonly publisher: BroadbandPublisher,
		private readonly subscriber: BroadbandSubscriber,
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

		if (systemMessage.messageType !== SystemMessageType.QueryRequest) {
			return;
		}

		const queryRequest = systemMessage as QueryRequest;
		logger.debug(
			'Received QueryRequest, content: %s metadata: %s',
			content,
			metadata
		);

		let readableStream: Readable;
		switch (queryRequest.queryType) {
			case QueryType.Last: {
				const { last } = queryRequest.queryOptions as QueryLastOptions;

				readableStream = this.logStore!.requestLast(
					queryRequest.streamId,
					queryRequest.partition,
					last
				);
				break;
			}
			case QueryType.From: {
				const { from, publisherId, limit } =
					queryRequest.queryOptions as QueryFromOptions;

				readableStream = this.logStore!.requestFrom(
					queryRequest.streamId,
					queryRequest.partition,
					from.timestamp,
					from.sequenceNumber || MIN_SEQUENCE_NUMBER_VALUE,
					publisherId,
					limit
				);
				break;
			}
			case QueryType.Range: {
				const { from, publisherId, to, msgChainId, limit } =
					queryRequest.queryOptions as QueryRangeOptions;

				readableStream = this.logStore!.requestRange(
					queryRequest.streamId,
					queryRequest.partition,
					from.timestamp,
					from.sequenceNumber || MIN_SEQUENCE_NUMBER_VALUE,
					to.timestamp,
					to.sequenceNumber || MAX_SEQUENCE_NUMBER_VALUE,
					publisherId,
					msgChainId,
					limit
				);
				break;
			}
			default:
				throw new Error('Unknown QueryType');
		}

		const { size, hash } = await this.hashResponse(
			queryRequest.requestId,
			readableStream
		);

		const queryResponse = new QueryResponse({
			seqNum: this.seqNum++,
			requestId: queryRequest.requestId,
			size,
			hash,
			signature: await this.signer.signMessage(hash),
		});
		await this.publisher.publish(queryResponse.serialize());
	}

	private hashResponse = async (id: string, data: Readable) => {
		let size = 0;
		let hash = keccak256(Uint8Array.from(Buffer.from(id)));
		for await (const chunk of data) {
			const streamMessage = chunk as StreamMessage;
			const content = streamMessage.getContent(false);
			size += Buffer.byteLength(content, 'utf8');
			hash = keccak256(Uint8Array.from(Buffer.from(hash + content)));
		}
		hash = keccak256(Uint8Array.from(Buffer.from(hash + size)));
		return { size, hash };
	};
}
