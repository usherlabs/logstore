import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

interface ProofOfReportOptions extends SystemMessageOptions {
	address: string;
	hash: string;
	signature: string;
	timestamp: number;
}

export class ProofOfReport extends SystemMessage {
	address: string;
	hash: string;
	signature: string;
	timestamp: number;

	constructor({
		version = SystemMessage.LATEST_VERSION,
		address,
		hash,
		signature,
		timestamp = Date.now(),
	}: ProofOfReportOptions) {
		super(version, SystemMessageType.ProofOfReport);

		this.address = address;
		this.hash = hash;
		this.signature = signature;
		this.timestamp = timestamp;
	}
}
