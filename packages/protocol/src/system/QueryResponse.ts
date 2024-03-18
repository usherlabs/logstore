import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

interface QueryResponseOptions extends SystemMessageOptions {
	requestId: string;
	requestPublisherId: string;
	hash: string;
	// hashMap: Map<string, string>;
	bloomFilter: string;
}

let messageSeqNum = 0;

export class QueryResponse extends SystemMessage {
	requestId: string;
	requestPublisherId: string;
	hash: string;
	// hashMap: Map<string, string>;
	bloomFilter: string;

	constructor({
		version = SystemMessage.LATEST_VERSION,
		seqNum = messageSeqNum++,
		requestId,
		requestPublisherId,
		// hashMap,
		hash,
		bloomFilter,
	}: QueryResponseOptions) {
		super(version, SystemMessageType.QueryResponse, seqNum);

		this.requestId = requestId;
		this.requestPublisherId = requestPublisherId;
		this.hash = hash;
		// this.hashMap = hashMap;
		this.bloomFilter = bloomFilter;
	}
}
