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

export class RecoveryRequest extends SystemMessage {
	requestId: string;
	from: number;
	to: number;

	constructor({
		version = SystemMessage.LATEST_VERSION,
		seqNum,
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
