import { MessageMetadata } from '../interfaces/MessageMetadata';
import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

interface RecoveryResponseOptions extends SystemMessageOptions {
	requestId: string;
	payload: [SystemMessage, MessageMetadata][];
}

let messageSeqNum = 0;

export class RecoveryResponse extends SystemMessage {
	requestId: string;
	payload: [SystemMessage, MessageMetadata][];

	constructor({
		version = SystemMessage.LATEST_VERSION,
		seqNum = messageSeqNum++,
		requestId,
		payload,
	}: RecoveryResponseOptions) {
		super(version, SystemMessageType.RecoveryResponse, seqNum);
		this.requestId = requestId;
		this.payload = payload;
	}
}
