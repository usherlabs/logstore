import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

interface QueryPropagateOptions extends SystemMessageOptions {
	requestId: string;
	requestPublisherId: string;
	payload: [string, string][];
}

export class QueryPropagate extends SystemMessage {
	requestId: string;
	requestPublisherId: string;
	payload: [string, string][];

	constructor({
		version = SystemMessage.LATEST_VERSION,
		seqNum,
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
