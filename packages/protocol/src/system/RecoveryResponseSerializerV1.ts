import { Serializer } from '../abstracts/Serializer';
import { MessageMetadata } from '../interfaces/MessageMetadata';
import { RecoveryResponse } from './RecoveryResponse';
import { SystemMessage, SystemMessageType } from './SystemMessage';

const VERSION = 1;

export default class RecoveryResponseSerializerV1 extends Serializer<RecoveryResponse> {
	toArray(message: RecoveryResponse): any[] {
		const payload = message.payload.map(([content, metadata]) => {
			return [
				content.serialize(),
				[
					metadata.streamId,
					metadata.streamPartition,
					metadata.timestamp,
					metadata.sequenceNumber,
					Buffer.from(metadata.signature).toString('base64'),
					metadata.signatureType,
					metadata.publisherId,
					metadata.msgChainId,
				],
			];
		});

		return [
			VERSION,
			SystemMessageType.RecoveryResponse,
			message.seqNum,
			message.requestId,
			payload,
		];
	}

	fromArray(arr: any[]): RecoveryResponse {
		const [version, _messageType, seqNum, requestId, payload] = arr;

		const messages: [SystemMessage, MessageMetadata][] = (
			payload as [unknown, unknown[]][]
		).map((item) => {
			const [messageArr, metadatArr] = item;
			const message = SystemMessage.deserialize(messageArr);
			const metadata = {
				streamId: metadatArr[0],
				streamPartition: metadatArr[1],
				timestamp: metadatArr[2],
				sequenceNumber: metadatArr[3],
				signature: Buffer.from(metadatArr[4] as string, 'base64'),
				signatureType: metadatArr[5],
				publisherId: metadatArr[6],
				msgChainId: metadatArr[7],
			} as MessageMetadata;
			return [message, metadata];
		});

		return new RecoveryResponse({
			version,
			seqNum,
			requestId,
			payload: messages,
		});
	}
}

SystemMessage.registerSerializer(
	VERSION,
	SystemMessageType.RecoveryResponse,
	new RecoveryResponseSerializerV1()
);
