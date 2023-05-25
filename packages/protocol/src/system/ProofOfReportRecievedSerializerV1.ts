import { Serializer } from '../Serializer';
import { ProofOfReportRecieved } from './ProofOfReportRecieved';
import { SystemMessage, SystemMessageType } from './SystemMessage';

const VERSION = 1;

export default class ProofOfReportRecievedSerializerV1 extends Serializer<ProofOfReportRecieved> {
	toArray(message: ProofOfReportRecieved): any[] {
		return [
			VERSION,
			SystemMessageType.ProofOfReportRecieved,
			message.address,
			message.hash,
			message.signature,
		];
	}

	fromArray(arr: any[]): ProofOfReportRecieved {
		const [version, _messageType, address, hash, signature] = arr;

		return new ProofOfReportRecieved({
			version,
			address,
			hash,
			signature,
		});
	}
}

SystemMessage.registerSerializer(
	VERSION,
	SystemMessageType.ProofOfReportRecieved,
	new ProofOfReportRecievedSerializerV1()
);
