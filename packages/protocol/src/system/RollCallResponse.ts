import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

interface RollCallResponseOptions extends SystemMessageOptions {
	requestId: string;
}

export class RollCallResponse extends SystemMessage {
	requestId: string;

	constructor({
		version = SystemMessage.LATEST_VERSION,
		requestId,
	}: RollCallResponseOptions) {
		super(version, SystemMessageType.RollCallResponse);

		this.requestId = requestId;
	}
}
