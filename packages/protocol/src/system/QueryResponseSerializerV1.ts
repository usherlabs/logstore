import { Serializer } from '../Serializer';
import { SystemMessage, SystemMessageType } from './SystemMessage';
import { QueryResponse } from './QueryResponse';

const VERSION = 1;

export default class QueryResponseSerializerV1 extends Serializer<QueryResponse> {
	toArray(message: QueryResponse): any[] {
		return [
			VERSION,
			SystemMessageType.QueryResponse,
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

SystemMessage.registerSerializer(
	VERSION,
	SystemMessageType.QueryResponse,
	new QueryResponseSerializerV1()
);
