import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

interface ProofOfReportOptions extends SystemMessageOptions {
	address: string;
	hash: string;
	toth: string;
	timestamp: number;
	signature: string;
}

let messageSeqNum = 0;

export class ProofOfReport extends SystemMessage {
	address: string;
	hash: string; // Hash of report - shared regardless of time
	toth: string; // Time-based one-time hash
	timestamp: number;
	signature: string;

	constructor({
		version = SystemMessage.LATEST_VERSION,
		seqNum = messageSeqNum++,
		address,
		hash,
		toth,
		timestamp = Date.now(),
		signature,
	}: ProofOfReportOptions) {
		super(version, SystemMessageType.ProofOfReport, seqNum);

		this.address = address;
		this.hash = hash;
		this.toth = toth;
		this.timestamp = timestamp;
		this.signature = signature;
	}
}
