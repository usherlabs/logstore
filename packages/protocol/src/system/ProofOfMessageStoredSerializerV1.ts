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
			message.size,
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
			size,
			hash,
		] = arr;

		return new ProofOfMessageStored({
			version,
			streamId,
			partition,
			timestamp,
			sequenceNumber,
			size,
			hash,
		});
	}
}

SystemMessage.registerSerializer(
	VERSION,
	SystemMessageType.ProofOfMessageStored,
	new ProofOfMessageStoredSerializerV1()
);
