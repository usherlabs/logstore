import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

interface QueryResponseOptions extends SystemMessageOptions {
	requestId: string;
	hash: string;
}

export class QueryResponse extends SystemMessage {
	requestId: string;
	hash: string;

	constructor({
		version = SystemMessage.LATEST_VERSION,
		requestId,
		hash,
	}: QueryResponseOptions) {
		super(version, SystemMessageType.QueryResponse);

		this.requestId = requestId;
		this.hash = hash;
	}
}
