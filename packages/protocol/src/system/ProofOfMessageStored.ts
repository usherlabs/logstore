import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

export class ProofOfMessageStored extends SystemMessage {
	streamId: string;
	partition: number;
	timestamp: number;
	sequenceNumber: number;
	size: number;
	hash: string;

	constructor({
		version = SystemMessage.LATEST_VERSION,
		streamId,
		partition,
		timestamp,
		sequenceNumber,
		size,
		hash,
	}: ProofOfMessageStoredOptions) {
		super(version, SystemMessageType.ProofOfMessageStored);

		this.streamId = streamId;
		this.partition = partition;
		this.timestamp = timestamp;
		this.sequenceNumber = sequenceNumber;
		this.size = size;
		this.hash = hash;
	}
}

interface ProofOfMessageStoredOptions extends SystemMessageOptions {
	streamId: string;
	partition: number;
	timestamp: number;
	sequenceNumber: number;
	size: number;
	hash: string;
}
