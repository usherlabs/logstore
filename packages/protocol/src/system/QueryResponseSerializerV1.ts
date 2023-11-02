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
			JSON.stringify(Array.from(message.hashMap.entries())),
		];
	}

	fromArray(arr: any[]): QueryResponse {
		const [
			version,
			_messageType,
			seqNum,
			requestId,
			requestPublisherId,
			hashMap,
		] = arr;

		return new QueryResponse({
			version,
			seqNum,
			requestId,
			requestPublisherId,
			hashMap: new Map(JSON.parse(hashMap)),
		});
	}
}

SystemMessage.registerSerializer(
	VERSION,
	SystemMessageType.QueryResponse,
	new QueryResponseSerializerV1()
);
