import { Serializer } from '../abstracts/Serializer';
import { RecoveryResponse } from './RecoveryResponse';
import { SystemMessage, SystemMessageType } from './SystemMessage';

const VERSION = 1;

export default class RecoveryResponseSerializerV1 extends Serializer<RecoveryResponse> {
	toArray(message: RecoveryResponse): any[] {
		return [
			VERSION,
			SystemMessageType.RecoveryResponse,
			message.requestId,
			message.content,
			message.metadata.streamId,
			message.metadata.streamPartition,
			message.metadata.timestamp,
			message.metadata.sequenceNumber,
			message.metadata.signature,
			message.metadata.publisherId,
			message.metadata.msgChainId,
		];
	}

	fromArray(arr: any[]): RecoveryResponse {
		const [
			version,
			_messageType,
			requestId,
			content,
			streamId,
			streamPartition,
			timestamp,
			sequenceNumber,
			signature,
			publisherId,
			msgChainId,
		] = arr;

		return new RecoveryResponse({
			version,
			requestId,
			content,
			metadata: {
				streamId,
				streamPartition,
				timestamp,
				sequenceNumber,
				signature,
				publisherId,
				msgChainId,
			},
		});
	}
}

SystemMessage.registerSerializer(
	VERSION,
	SystemMessageType.RecoveryResponse,
	new RecoveryResponseSerializerV1()
);
