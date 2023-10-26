import { Serializer } from '../abstracts/Serializer';
import { QueryMetadataRequest } from './QueryMetadataRequest';
import { SystemMessage, SystemMessageType } from './SystemMessage';

const VERSION = 1;

export default class QueryMetadataRequestSerializerV1 extends Serializer<QueryMetadataRequest> {
	toArray(message: QueryMetadataRequest): any[] {
		return [
			VERSION,
			SystemMessageType.QueryMetadataRequest,
			message.seqNum,
			message.requestId,
			message.from,
			message.to,
		];
	}

	fromArray(arr: any[]): QueryMetadataRequest {
		const [version, _messageType, seqNum, requestId, from, to, retryCount] =
			arr;

		return new QueryMetadataRequest({
			version,
			seqNum,
			requestId,
			from,
			to,
		});
	}
}

SystemMessage.registerSerializer(
	VERSION,
	SystemMessageType.QueryMetadataRequest,
	new QueryMetadataRequestSerializerV1()
);
