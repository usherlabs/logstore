import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

interface RecoveryCompleteOptions extends SystemMessageOptions {
	requestId: string;
}

export class RecoveryComplete extends SystemMessage {
	requestId: string;

	constructor({
		version = SystemMessage.LATEST_VERSION,
		requestId,
	}: RecoveryCompleteOptions) {
		super(version, SystemMessageType.RecoveryComplete);

		this.requestId = requestId;
	}
}
