import { Serializer } from '../abstracts/Serializer';
import { RollCallRequest } from './RollCallRequest';
import { SystemMessage, SystemMessageType } from './SystemMessage';

const VERSION = 1;

export default class RollCallRequestSerializerV1 extends Serializer<RollCallRequest> {
	toArray(message: RollCallRequest): any[] {
		return [
			VERSION,
			SystemMessageType.RollCallRequest,
			message.seqNum,
			message.requestId,
		];
	}

	fromArray(arr: any[]): RollCallRequest {
		const [version, _messageType, seqNum, requestId] = arr;

		return new RollCallRequest({
			version,
			seqNum,
			requestId,
		});
	}
}

SystemMessage.registerSerializer(
	VERSION,
	SystemMessageType.RollCallRequest,
	new RollCallRequestSerializerV1()
);
