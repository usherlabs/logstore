import { Serializer } from '../Serializer';
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
			message.consumer,
			message.queryOptions,
			message.streamId,
		];
	}

	fromArray(arr: any[]): QueryResponse {
		const [
			version,
			_messageType,
			requestId,
			size,
			hash,
			signature,
			consumer,
			queryOptions,
			streamId,
		] = arr;

		return new QueryResponse({
			version,
			requestId,
			size,
			hash,
			signature,
			consumer,
			queryOptions,
			streamId,
		});
	}
}

SystemMessage.registerSerializer(
	VERSION,
	SystemMessageType.QueryResponse,
	new QueryResponseSerializerV1()
);
