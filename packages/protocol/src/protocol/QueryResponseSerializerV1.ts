import QueryMessage, { QueryMessageType } from './QueryMessage';
import QueryResponse from './QueryResponse';
import { Serializer } from '../Serializer';

const VERSION = 1;

export default class QueryResponseSerializerV1 extends Serializer<QueryResponse> {
	toArray(message: QueryResponse): any[] {
		return [
			VERSION,
			QueryMessageType.QueryResponse,
			message.requestId,
			message.isFinal,
			message.payload,
		];
	}

	fromArray(arr: any[]): QueryResponse {
		const [version, _messageType, requestId, isFinal, payload] = arr;

		return new QueryResponse({
			version,
			requestId,
			isFinal,
			payload,
		});
	}
}

QueryMessage.registerSerializer(
	VERSION,
	QueryMessageType.QueryResponse,
	new QueryResponseSerializerV1()
);
