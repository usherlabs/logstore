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
			message.hash,
			// JSON.stringify(Array.from(message.hashMap.entries())),
			message.bloomFilter,
		];
	}

	fromArray(arr: any[]): QueryResponse {
		const [
			version,
			_messageType,
			seqNum,
			requestId,
			requestPublisherId,
			hash,
			// hashMap,
			bloomFilter,
		] = arr;

		return new QueryResponse({
			version,
			seqNum,
			requestId,
			requestPublisherId,
			hash,
			// hashMap: new Map(JSON.parse(hashMap)),
			bloomFilter,
		});
	}
}

SystemMessage.registerSerializer(
	VERSION,
	SystemMessageType.QueryResponse,
	new QueryResponseSerializerV1()
);
