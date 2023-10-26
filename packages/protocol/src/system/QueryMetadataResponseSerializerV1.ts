import { Serializer } from '../abstracts/Serializer';
import { MessageMetadata } from '../interfaces/MessageMetadata';
import { QueryMetadataResponse } from './QueryMetadataResponse';
import { SystemMessage, SystemMessageType } from './SystemMessage';

const VERSION = 1;

const queryMetadataResponseToArray = (message: QueryMetadataResponse) => {
	const payload = message.payload.map(([content, metadata]) => {
		return [
			content.serialize(),
			[
				metadata.streamId,
				metadata.streamPartition,
				metadata.timestamp,
				metadata.sequenceNumber,
				metadata.signature,
				metadata.publisherId,
				metadata.msgChainId,
			],
		];
	});

	return [
		VERSION,
		SystemMessageType.QueryMetadataResponse,
		message.seqNum,
		message.requestId,
		message.requestTimestamp,
		message.from,
		message.to,
		payload,
		message.isLast ? 1 : 0,
	] as const;
};

export default class QueryMetadataResponseSerializerV1 extends Serializer<QueryMetadataResponse> {
	toArray(message: QueryMetadataResponse): any[] {
		return queryMetadataResponseToArray(message) as unknown as any[];
	}

	fromArray(arr: any[]): QueryMetadataResponse {
		const [
			version,
			_messageType,
			seqNum,
			requestId,
			requestTimestamp,
			from,
			to,
			payload,
			isLast,
		] = arr as unknown as ReturnType<typeof queryMetadataResponseToArray>;

		const messages: [SystemMessage, MessageMetadata][] = (
			payload as [unknown, unknown[]][]
		).map((item) => {
			const [messageArr, metadatArr] = item;
			const message = SystemMessage.deserialize(messageArr);
			const metadata = {
				streamId: metadatArr[0],
				streamPartition: metadatArr[1],
				timestamp: metadatArr[2],
				sequenceNumber: metadatArr[3],
				signature: metadatArr[4],
				publisherId: metadatArr[5],
				msgChainId: metadatArr[6],
			} as MessageMetadata;
			return [message, metadata];
		});

		return new QueryMetadataResponse({
			version,
			seqNum,
			requestId,
			requestTimestamp,
			from,
			to,
			payload: messages,
			isLast: isLast === 1,
		});
	}
}

SystemMessage.registerSerializer(
	VERSION,
	SystemMessageType.QueryMetadataResponse,
	new QueryMetadataResponseSerializerV1()
);
