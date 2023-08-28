import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

interface RecoveryCompleteOptions extends SystemMessageOptions {
	requestId: string;
	seqNum: number;
	isFulfilled: boolean;
}

export class RecoveryComplete extends SystemMessage {
	requestId: string;
	seqNum: number;
	isFulfilled: boolean;

	constructor({
		version = SystemMessage.LATEST_VERSION,
		requestId,
		seqNum,
		isFulfilled,
	}: RecoveryCompleteOptions) {
		super(version, SystemMessageType.RecoveryComplete);

		this.requestId = requestId;
		this.seqNum = seqNum;
		this.isFulfilled = isFulfilled;
	}
}
