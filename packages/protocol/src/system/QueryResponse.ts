import { validateIsString } from '../utils/validations';
import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

interface QueryResponseOptions extends SystemMessageOptions {
	requestId: string;
	isFinal: boolean;
	payload: string;
}

export class QueryResponse extends SystemMessage {
	requestId: string;
	isFinal: boolean;
	payload: string;

	constructor({
		version = SystemMessage.LATEST_VERSION,
		requestId,
		isFinal,
		payload,
	}: QueryResponseOptions) {
		super(version, SystemMessageType.QueryResponse);

		this.requestId = requestId;
		this.isFinal = isFinal;

		validateIsString('payload', payload);
		this.payload = payload;
	}
}
