import { MessageMetadata } from '../interfaces/MessageMetadata';
import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

interface RecoveryResponseOptions extends SystemMessageOptions {
	requestId: string;
	seqNum: number;
	payload: [SystemMessage, MessageMetadata][];
}

export class RecoveryResponse extends SystemMessage {
	requestId: string;
	seqNum: number;
	payload: [SystemMessage, MessageMetadata][];

	constructor({
		version = SystemMessage.LATEST_VERSION,
		requestId,
		seqNum,
		payload,
	}: RecoveryResponseOptions) {
		super(version, SystemMessageType.RecoveryResponse);
		this.requestId = requestId;
		this.seqNum = seqNum;
		this.payload = payload;
	}
}
