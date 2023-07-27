import { Serializer } from '../abstracts/Serializer';
import { RollCallRequest } from './RollCallRequest';
import { SystemMessage, SystemMessageType } from './SystemMessage';

const VERSION = 1;

export default class RollCallRequestSerializerV1 extends Serializer<RollCallRequest> {
	toArray(message: RollCallRequest): any[] {
		return [VERSION, SystemMessageType.RollCallRequest, message.requestId];
	}

	fromArray(arr: any[]): RollCallRequest {
		const [version, _messageType, requestId] = arr;

		return new RollCallRequest({
			version,
			requestId,
		});
	}
}

SystemMessage.registerSerializer(
	VERSION,
	SystemMessageType.RollCallRequest,
	new RollCallRequestSerializerV1()
);
