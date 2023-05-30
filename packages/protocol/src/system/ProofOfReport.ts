import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

interface ProofOfReportOptions extends SystemMessageOptions {
	address: string;
	hash: string;
	signature: string;
}

export class ProofOfReport extends SystemMessage {
	address: string;
	hash: string;
	signature: string;

	constructor({
		version = SystemMessage.LATEST_VERSION,
		address,
		hash,
		signature,
	}: ProofOfReportOptions) {
		super(version, SystemMessageType.ProofOfReport);

		this.address = address;
		this.hash = hash;
		this.signature = signature;
	}
}
