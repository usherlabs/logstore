import { LogStoreClient, MessageMetadata } from '@logsn/client';
import {
	QueryFromOptions,
	QueryLastOptions,
	QueryRangeOptions,
	QueryRequest,
	QueryResponse,
	QueryType,
} from '@logsn/protocol';
import { Logger } from '@streamr/utils';
import { Signer } from 'ethers';
import { Readable } from 'stream';

import { StreamPublisher } from '../../../shared/StreamPublisher';
import { hashResponse } from '../Consensus';
import {
	LogStore,
	MAX_SEQUENCE_NUMBER_VALUE,
	MIN_SEQUENCE_NUMBER_VALUE,
} from '../LogStore';

export async function handeQueryRequest(
	logStore: LogStore,
	logStoreClient: LogStoreClient,
	publisher: StreamPublisher,
	signer: Signer,
	logger: Logger,
	queryRequest: QueryRequest,
	metadata: MessageMetadata
) {
	// Do not process own messages
	if (metadata.publisherId === (await logStoreClient.getAddress())) {
		return;
	}

	logger.trace('Deserialized queryRequest: %s', queryRequest);

	let readableStream: Readable;
	switch (queryRequest.queryType) {
		case QueryType.Last: {
			const { last } = queryRequest.queryOptions as QueryLastOptions;

			readableStream = logStore!.requestLast(
				queryRequest.streamId,
				queryRequest.partition,
				last
			);
			break;
		}
		case QueryType.From: {
			const { from, publisherId } =
				queryRequest.queryOptions as QueryFromOptions;

			readableStream = logStore.requestFrom(
				queryRequest.streamId,
				queryRequest.partition,
				from.timestamp,
				from.sequenceNumber || MIN_SEQUENCE_NUMBER_VALUE,
				publisherId
			);
			break;
		}
		case QueryType.Range: {
			const { from, publisherId, to, msgChainId } =
				queryRequest.queryOptions as QueryRangeOptions;

			readableStream = logStore.requestRange(
				queryRequest.streamId,
				queryRequest.partition,
				from.timestamp,
				from.sequenceNumber || MIN_SEQUENCE_NUMBER_VALUE,
				to.timestamp,
				to.sequenceNumber || MAX_SEQUENCE_NUMBER_VALUE,
				publisherId,
				msgChainId
			);
			break;
		}
		default:
			throw new Error('Unknown QueryType');
	}

	const { size, hash } = await hashResponse(
		queryRequest.requestId,
		readableStream
	);

	const queryResponse = new QueryResponse({
		requestId: queryRequest.requestId,
		size,
		hash,
		signature: await signer.signMessage(hash),
	});
	await publisher.publish(queryResponse.serialize());
}
