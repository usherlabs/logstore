import { Serializer } from '../Serializer';
import { ProofOfReport } from './ProofOfReport';
import { SystemMessage, SystemMessageType } from './SystemMessage';

const VERSION = 1;

export default class ProofOfReportSerializerV1 extends Serializer<ProofOfReport> {
	toArray(message: ProofOfReport): any[] {
		return [
			VERSION,
			SystemMessageType.ProofOfReport,
			message.address,
			message.hash,
			message.signature,
		];
	}

	fromArray(arr: any[]): ProofOfReport {
		const [version, _messageType, address, hash, signature] = arr;

		return new ProofOfReport({
			version,
			address,
			hash,
			signature,
		});
	}
}

SystemMessage.registerSerializer(
	VERSION,
	SystemMessageType.ProofOfReport,
	new ProofOfReportSerializerV1()
);
