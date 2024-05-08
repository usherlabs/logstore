import { Serializer } from '../abstracts/Serializer';
import { QueryPropagate } from './QueryPropagate';
import { SystemMessage, SystemMessageType } from './SystemMessage';

const VERSION = 1;

export default class QueryPropagateSerializerV1 extends Serializer<QueryPropagate> {
	toArray(message: QueryPropagate): any[] {
		return [
			VERSION,
			SystemMessageType.QueryPropagate,
			message.seqNum,
			message.requestId,
			message.requestPublisherId,
			message.payload.map((arr) =>
				Buffer.from(arr).toString('base64')
			),
		];
	}

	fromArray(arr: any[]): QueryPropagate {
		const [
			version,
			_messageType,
			seqNum,
			requestId,
			requestPublisherId,
			payload,
		] = arr;

		return new QueryPropagate({
			version,
			seqNum,
			requestId,
			requestPublisherId,
			payload: (payload as string[]).map((str) =>
				new Uint8Array(Buffer.from(str, 'base64'))),
		});
	}
}

SystemMessage.registerSerializer(
	VERSION,
	SystemMessageType.QueryPropagate,
	new QueryPropagateSerializerV1()
);
