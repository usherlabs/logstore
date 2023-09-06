import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

interface RollCallRequestOptions extends SystemMessageOptions {
	requestId: string;
}

export class RollCallRequest extends SystemMessage {
	requestId: string;

	constructor({
		version = SystemMessage.LATEST_VERSION,
		seqNum,
		requestId,
	}: RollCallRequestOptions) {
		super(version, SystemMessageType.RollCallRequest, seqNum);

		this.requestId = requestId;
	}
}
