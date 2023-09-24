import { Serializer } from '../abstracts/Serializer';
import { RecoveryComplete } from './RecoveryComplete';
import { SystemMessage, SystemMessageType } from './SystemMessage';

const VERSION = 1;

export default class RecoveryCompleteSerializerV1 extends Serializer<RecoveryComplete> {
	toArray(message: RecoveryComplete): any[] {
		return [
			VERSION,
			SystemMessageType.RecoveryComplete,
			message.seqNum,
			message.requestId,
			message.isFulfilled,
		];
	}

	fromArray(arr: any[]): RecoveryComplete {
		const [version, _messageType, seqNum, requestId, isFulfilled] = arr;

		return new RecoveryComplete({
			version,
			seqNum,
			requestId,
			isFulfilled,
		});
	}
}

SystemMessage.registerSerializer(
	VERSION,
	SystemMessageType.RecoveryComplete,
	new RecoveryCompleteSerializerV1()
);
