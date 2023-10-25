import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

interface QueryResponseOptions extends SystemMessageOptions {
	requestId: string;
	requestPublisherId: string;
	hashMap: Map<string, string>;
}

let messageSeqNum = 0;

export class QueryResponse extends SystemMessage {
	requestId: string;
	requestPublisherId: string;
	hashMap: Map<string, string>;

	constructor({
		version = SystemMessage.LATEST_VERSION,
		seqNum = messageSeqNum++,
		requestId,
		requestPublisherId,
		hashMap,
	}: QueryResponseOptions) {
		super(version, SystemMessageType.QueryResponse, seqNum);

		this.requestId = requestId;
		this.requestPublisherId = requestPublisherId;
		this.hashMap = hashMap;
	}
}
