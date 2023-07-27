import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

interface RecoveryRequestOptions extends SystemMessageOptions {
	requestId: string;
}

export class RecoveryRequest extends SystemMessage {
	requestId: string;

	constructor({
		version = SystemMessage.LATEST_VERSION,
		requestId,
	}: RecoveryRequestOptions) {
		super(version, SystemMessageType.RecoveryRequest);
		this.requestId = requestId;
	}
}
