import QueryMessage, {
	QueryMessageOptions,
	QueryMessageType,
} from './QueryMessage';

export enum QueryType {
	Last = 0,
	From = 1,
	Range = 2,
}

export interface QueryRef {
	timestamp: number | Date | string;
	sequenceNumber?: number;
}
/**
 * Resend the latest "n" messages.
 */
export interface QueryLastOptions {
	last: number;
}

/**
 * Resend messages starting from a given point in time.
 */
export interface QueryFromOptions {
	from: QueryRef;
	publisherId?: string;
}

/**
 * Resend messages between two points in time.
 */
export interface QueryRangeOptions {
	from: QueryRef;
	to: QueryRef;
	msgChainId?: string;
	publisherId?: string;
}

/**
 * The supported resend types.
 */
export type QueryOptions =
	| QueryLastOptions
	| QueryFromOptions
	| QueryRangeOptions;

interface QueryRequestOptions extends QueryMessageOptions {
	streamId: string;
	queryType: QueryType;
	queryOptions: QueryOptions;
}

export default class QueryRequest extends QueryMessage {
	streamId: string;
	queryType: QueryType;
	queryOptions: QueryOptions;

	constructor({
		version = QueryMessage.LATEST_VERSION,
		requestId,
		streamId,
		queryType,
		queryOptions,
	}: QueryRequestOptions) {
		super(version, QueryMessageType.QueryRequest, requestId);

		// TODO: Validate the arguments
		this.streamId = streamId;
		this.queryType = queryType;
		this.queryOptions = queryOptions;
	}
}
