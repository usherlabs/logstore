import QueryMessage, {
	QueryMessageOptions,
	QueryMessageType,
} from './QueryMessage';
import { validateIsString } from './utils/validations';

interface QueryResponseOptions extends QueryMessageOptions {
	payload: string;
}

export default class QueryResponse extends QueryMessage {
	payload: string;

	constructor({
		version = QueryMessage.LATEST_VERSION,
		requestId,
		payload,
	}: QueryResponseOptions) {
		super(version, QueryMessageType.QueryResponse, requestId);

		validateIsString('payload', payload);
		this.payload = payload;
	}
}
