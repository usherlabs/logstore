import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

interface RecoveryCompleteOptions extends SystemMessageOptions {
	requestId: string;
	isFulfilled: boolean;
}

export class RecoveryComplete extends SystemMessage {
	requestId: string;
	isFulfilled: boolean;

	constructor({
		version = SystemMessage.LATEST_VERSION,
		seqNum,
		requestId,
		isFulfilled,
	}: RecoveryCompleteOptions) {
		super(version, SystemMessageType.RecoveryComplete, seqNum);

		this.requestId = requestId;
		this.isFulfilled = isFulfilled;
	}
}
