import { MessageMetadata } from '../interfaces/MessageMetadata';
import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

interface QueryMetadataResponseOptions extends SystemMessageOptions {
	requestId: string;
	requestTimestamp: number;
	from: number;
	to: number;
	payload: [SystemMessage, MessageMetadata][];
	isLast: boolean;
}

export class QueryMetadataResponse extends SystemMessage {
	requestId: string;
	requestTimestamp: number;
	from: number;
	to: number;
	payload: [SystemMessage, MessageMetadata][];
	isLast: boolean;

	constructor({
		version = SystemMessage.LATEST_VERSION,
		seqNum,
		requestId,
		requestTimestamp,
		from,
		to,
		payload,
		isLast,
	}: QueryMetadataResponseOptions) {
		super(version, SystemMessageType.QueryMetadataResponse, seqNum);
		this.requestId = requestId;
		this.requestTimestamp = requestTimestamp;
		this.from = from;
		this.to = to;
		this.payload = payload;
		this.isLast = isLast;
	}
}
