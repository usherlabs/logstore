import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

interface ProofOfReportRecievedOptions extends SystemMessageOptions {
	address: string;
	hash: string;
	signature: string;
}

export class ProofOfReportRecieved extends SystemMessage {
	address: string;
	hash: string;
	signature: string;

	constructor({
		version = SystemMessage.LATEST_VERSION,
		address,
		hash,
		signature,
	}: ProofOfReportRecievedOptions) {
		super(version, SystemMessageType.ProofOfReportRecieved);

		this.address = address;
		this.hash = hash;
		this.signature = signature;
	}
}
