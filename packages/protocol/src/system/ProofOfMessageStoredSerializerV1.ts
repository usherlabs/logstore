import { Serializer } from '../Serializer';
import { ProofOfMessageStored } from './ProofOfMessageStored';
import { SystemMessage, SystemMessageType } from './SystemMessage';

const VERSION = 1;

export default class ProofOfMessageStoredSerializerV1 extends Serializer<ProofOfMessageStored> {
	toArray(message: ProofOfMessageStored): any[] {
		const result: any[] = [
			VERSION,
			SystemMessageType.ProofOfMessageStored,
			message.streamId,
			message.partition,
			message.timestamp,
			message.sequenceNumber,
			message.hash,
		];

		return result;
	}

	fromArray(arr: any[]): ProofOfMessageStored {
		const [
			version,
			_messageType,
			streamId,
			partition,
			timestamp,
			sequenceNumber,
			hash,
		] = arr;

		return new ProofOfMessageStored({
			version,
			streamId,
			partition,
			timestamp,
			sequenceNumber,
			hash,
		});
	}
}

SystemMessage.registerSerializer(
	VERSION,
	SystemMessageType.ProofOfMessageStored,
	new ProofOfMessageStoredSerializerV1()
);
