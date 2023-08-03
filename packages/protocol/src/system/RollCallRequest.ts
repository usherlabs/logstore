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
		requestId,
	}: RollCallRequestOptions) {
		super(version, SystemMessageType.RollCallRequest);

		this.requestId = requestId;
	}
}
