import { MessageMetadata } from '../interfaces/MessageMetadata';
import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

interface RecoveryResponseOptions extends SystemMessageOptions {
	requestId: string;
	content: unknown;
	metadata: MessageMetadata;
}

export class RecoveryResponse extends SystemMessage {
	requestId: string;
	content: unknown;
	metadata: MessageMetadata;

	constructor({
		version = SystemMessage.LATEST_VERSION,
		requestId,
		content,
		metadata,
	}: RecoveryResponseOptions) {
		super(version, SystemMessageType.RecoveryResponse);
		this.requestId = requestId;
		this.content = content;
		this.metadata = metadata;
	}
}
