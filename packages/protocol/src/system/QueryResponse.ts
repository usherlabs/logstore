import { MessageRef } from '@streamr/protocol';
import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

interface QueryResponseOptions extends SystemMessageOptions {
	requestId: string;
	requestPublisherId: string;
	isFinal: boolean;
	messageRefs: MessageRef[];
}

let messageSeqNum = 0;

export class QueryResponse extends SystemMessage {
	public readonly requestId: string;
	public readonly requestPublisherId: string;
	public readonly isFinal: boolean;
	public readonly messageRefs: MessageRef[] = [];

	constructor({
		version = SystemMessage.LATEST_VERSION,
		seqNum = messageSeqNum++,
		requestId,
		requestPublisherId,
		isFinal,
		messageRefs,
	}: QueryResponseOptions) {
		super(version, SystemMessageType.QueryResponse, seqNum);

		this.requestId = requestId;
		this.requestPublisherId = requestPublisherId;
		this.isFinal = isFinal;
		this.messageRefs = messageRefs;
	}
}
