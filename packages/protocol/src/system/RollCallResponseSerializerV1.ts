import { Serializer } from '../abstracts/Serializer';
import { RollCallResponse } from './RollCallResponse';
import { SystemMessage, SystemMessageType } from './SystemMessage';

const VERSION = 1;

export default class RollCallResponseSerializerV1 extends Serializer<RollCallResponse> {
	toArray(message: RollCallResponse): any[] {
		return [VERSION, SystemMessageType.RollCallResponse, message.requestId];
	}

	fromArray(arr: any[]): RollCallResponse {
		const [version, _messageType, requestId] = arr;

		return new RollCallResponse({
			version,
			requestId,
		});
	}
}

SystemMessage.registerSerializer(
	VERSION,
	SystemMessageType.RollCallResponse,
	new RollCallResponseSerializerV1()
);
