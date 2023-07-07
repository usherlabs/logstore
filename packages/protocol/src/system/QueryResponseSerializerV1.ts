import { Serializer } from '../abstracts/Serializer';
import { QueryResponse } from './QueryResponse';
import { SystemMessage, SystemMessageType } from './SystemMessage';

const VERSION = 1;

export default class QueryResponseSerializerV1 extends Serializer<QueryResponse> {
	toArray(message: QueryResponse): any[] {
		return [
			VERSION,
			SystemMessageType.QueryResponse,
			message.requestId,
			message.size,
			message.hash,
			message.signature,
		];
	}

	fromArray(arr: any[]): QueryResponse {
		const [version, _messageType, requestId, size, hash, signature] = arr;

		return new QueryResponse({
			version,
			requestId,
			size,
			hash,
			signature,
		});
	}
}

SystemMessage.registerSerializer(
	VERSION,
	SystemMessageType.QueryResponse,
	new QueryResponseSerializerV1()
);
