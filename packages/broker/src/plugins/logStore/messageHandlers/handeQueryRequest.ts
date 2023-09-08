import type { StreamMessage } from '@logsn/client';
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
import { keccak256 } from 'ethers/lib/utils';
import { Readable } from 'stream';

import { BroadbandPublisher } from '../../../shared/BroadbandPublisher';
import {
	LogStore,
	MAX_SEQUENCE_NUMBER_VALUE,
	MIN_SEQUENCE_NUMBER_VALUE,
} from '../LogStore';

const logger = new Logger(module);

let seqNum: number = 0;

const hashResponse = async (id: string, data: Readable) => {
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

export async function handeQueryRequest(
	logStore: LogStore,
	streamPublisher: BroadbandPublisher,
	signer: Signer,
	queryRequest: QueryRequest
) {
	logger.trace('Deserialized queryRequest: %s', JSON.stringify(queryRequest));

	let readableStream: Readable;
	switch (queryRequest.queryType) {
		case QueryType.Last: {
			const { last } = queryRequest.queryOptions as QueryLastOptions;

			readableStream = logStore.requestLast(
				queryRequest.streamId,
				queryRequest.partition,
				last
			);
			break;
		}
		case QueryType.From: {
			const { from, publisherId, limit } =
				queryRequest.queryOptions as QueryFromOptions;

			readableStream = logStore.requestFrom(
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

			readableStream = logStore.requestRange(
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

	const { size, hash } = await hashResponse(
		queryRequest.requestId,
		readableStream
	);

	const queryResponse = new QueryResponse({
		seqNum: seqNum++,
		requestId: queryRequest.requestId,
		size,
		hash,
		signature: await signer.signMessage(hash),
	});
	await streamPublisher.publish(queryResponse.serialize());
}
