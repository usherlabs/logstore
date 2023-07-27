import { Serializer } from '../abstracts/Serializer';
import { RecoveryRequest } from './RecoveryRequest';
import { SystemMessage, SystemMessageType } from './SystemMessage';

const VERSION = 1;

export default class RecoveryRequestSerializerV1 extends Serializer<RecoveryRequest> {
	toArray(message: RecoveryRequest): any[] {
		return [VERSION, SystemMessageType.RecoveryRequest, message.requestId];
	}

	fromArray(arr: any[]): RecoveryRequest {
		const [version, _messageType, requestId] = arr;

		return new RecoveryRequest({
			version,
			requestId,
		});
	}
}

SystemMessage.registerSerializer(
	VERSION,
	SystemMessageType.RecoveryRequest,
	new RecoveryRequestSerializerV1()
);
