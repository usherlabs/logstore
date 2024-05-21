import { MessageRef } from '@streamr/protocol';
import { Serializer } from '../abstracts/Serializer';
import { QueryResponse } from './QueryResponse';
import { SystemMessage, SystemMessageType } from './SystemMessage';

const VERSION = 1;

export default class QueryResponseSerializerV1 extends Serializer<QueryResponse> {
	toArray(message: QueryResponse): any[] {
		return [
			VERSION,
			SystemMessageType.QueryResponse,
			message.seqNum,
			message.requestId,
			message.requestPublisherId,
			message.isFinal,
			JSON.stringify(
				message.messageRefs.map(messageRef => [messageRef.timestamp, messageRef.sequenceNumber])),
		];
	}

	fromArray(arr: any[]): QueryResponse {
		const [
			version,
			_messageType,
			seqNum,
			requestId,
			requestPublisherId,
			isFinal,
			messageRef,
		] = arr;

		return new QueryResponse({
			version,
			seqNum,
			requestId,
			requestPublisherId,
			isFinal,
			messageRefs: (JSON.parse(messageRef) as [number, number][])
				.map(([timestamp, sequenceNumber]) => new MessageRef(timestamp, sequenceNumber)),
		});
	}
}

SystemMessage.registerSerializer(
	VERSION,
	SystemMessageType.QueryResponse,
	new QueryResponseSerializerV1()
);
