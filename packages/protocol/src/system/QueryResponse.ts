import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

interface QueryResponseOptions extends SystemMessageOptions {
	requestId: string;
	size: number;
	hash: string;
	signature: string;
}

export class QueryResponse extends SystemMessage {
	requestId: string;
	size: number;
	hash: string;
	signature: string;

	constructor({
		version = SystemMessage.LATEST_VERSION,
		requestId,
		size,
		hash,
		signature,
	}: QueryResponseOptions) {
		super(version, SystemMessageType.QueryResponse);

		this.requestId = requestId;
		this.size = size;
		this.hash = hash;
		this.signature = signature;
	}
}
