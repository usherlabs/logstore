import QueryMessage, {
	QueryMessageOptions,
	QueryMessageType,
} from './QueryMessage';
import { validateIsString } from '../utils/validations';

interface QueryResponseOptions extends QueryMessageOptions {
	isFinal: boolean;
	payload: string;
}

export default class QueryResponse extends QueryMessage {
	isFinal: boolean;
	payload: string;

	constructor({
		version = QueryMessage.LATEST_VERSION,
		requestId,
		isFinal,
		payload,
	}: QueryResponseOptions) {
		super(version, QueryMessageType.QueryResponse, requestId);

		this.isFinal = isFinal;

		validateIsString('payload', payload);
		this.payload = payload;
	}
}
