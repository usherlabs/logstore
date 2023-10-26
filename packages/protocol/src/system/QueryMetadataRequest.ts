import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

interface QueryMetadataRequestOptions extends SystemMessageOptions {
	requestId: string;
	from: number;
	to: number;
}

export class QueryMetadataRequest extends SystemMessage {
	requestId: string;
	from: number;
	to: number;

	constructor({
		version = SystemMessage.LATEST_VERSION,
		seqNum,
		requestId,
		from,
		to,
	}: QueryMetadataRequestOptions) {
		super(version, SystemMessageType.QueryMetadataRequest, seqNum);
		this.requestId = requestId;
		this.from = from;
		this.to = to;
	}
}
