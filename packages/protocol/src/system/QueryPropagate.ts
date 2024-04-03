import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

interface QueryPropagateOptions extends SystemMessageOptions {
	requestId: string;
	requestPublisherId: string;
	payload: [string, Uint8Array][];
}

let messageSeqNum = 0;

export class QueryPropagate extends SystemMessage {
	requestId: string;
	requestPublisherId: string;
	payload: [string, Uint8Array][];

	constructor({
		version = SystemMessage.LATEST_VERSION,
		seqNum = messageSeqNum++,
		requestId,
		requestPublisherId,
		payload,
	}: QueryPropagateOptions) {
		super(version, SystemMessageType.QueryPropagate, seqNum);
		this.requestId = requestId;
		this.requestPublisherId = requestPublisherId;
		this.payload = payload;
	}
}
