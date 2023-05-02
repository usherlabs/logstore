import { QueryOptions } from './QueryRequest';
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
	consumer: string;
	streamId: string;
	queryOptions: QueryOptions;
}

export class QueryResponse extends SystemMessage {
	requestId: string;
	size: number;
	hash: string;
	signature: string;
	consumer: string;
	streamId: string;
	queryOptions: QueryOptions;

	constructor({
		version = SystemMessage.LATEST_VERSION,
		requestId,
		size,
		hash,
		signature,
		consumer,
		streamId,
		queryOptions,
	}: QueryResponseOptions) {
		super(version, SystemMessageType.QueryResponse);

		this.requestId = requestId;
		this.size = size;
		this.hash = hash;
		this.signature = signature;
		this.consumer = consumer;
		this.streamId = streamId;
		this.queryOptions = queryOptions;
	}
}
