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
		seqNum,
		requestId,
	}: RollCallResponseOptions) {
		super(version, SystemMessageType.RollCallResponse, seqNum);

		this.requestId = requestId;
	}
}
