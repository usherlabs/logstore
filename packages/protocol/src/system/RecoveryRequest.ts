import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

interface RecoveryRequestOptions extends SystemMessageOptions {
	requestId: string;
	from: number;
	to: number;
}

let messageSeqNum = 0;

export class RecoveryRequest extends SystemMessage {
	requestId: string;
	from: number;
	to: number;

	constructor({
		version = SystemMessage.LATEST_VERSION,
		seqNum = messageSeqNum++,
		requestId,
		from,
		to,
	}: RecoveryRequestOptions) {
		super(version, SystemMessageType.RecoveryRequest, seqNum);
		this.requestId = requestId;
		this.from = from;
		this.to = to;
	}
}
