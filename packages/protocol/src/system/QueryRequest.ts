import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

export enum QueryType {
	Last = 'last',
	From = 'from',
	Range = 'range',
}

export interface QueryRef {
	timestamp: number;
	sequenceNumber?: number;
}

/**
 * Query the latest "n" messages.
 */
export interface QueryLastOptions {
	last: number;
}

/**
 * Query messages starting from a given point in time.
 */
export interface QueryFromOptions {
	from: QueryRef;
	publisherId?: string;
	limit?: number;
}

/**
 * Query messages between two points in time.
 */
export interface QueryRangeOptions {
	from: QueryRef;
	to: QueryRef;
	msgChainId?: string;
	publisherId?: string;
	limit?: number;
}

/**
 * The supported Query types.
 */
export type QueryOptions =
	| QueryLastOptions
	| QueryFromOptions
	| QueryRangeOptions;

interface QueryRequestOptions extends SystemMessageOptions {
	requestId: string;
	consumerId: string;
	streamId: string;
	partition: number;
	queryType: QueryType;
	queryOptions: QueryOptions;
}

let messageSeqNum = 0;

export class QueryRequest extends SystemMessage {
	requestId: string;
	consumerId: string;
	streamId: string;
	partition: number;
	queryType: QueryType;
	queryOptions: QueryOptions;

	constructor({
		version = SystemMessage.LATEST_VERSION,
		seqNum = messageSeqNum++,
		requestId,
		consumerId,
		streamId,
		partition,
		queryType,
		queryOptions,
	}: QueryRequestOptions) {
		super(version, SystemMessageType.QueryRequest, seqNum);

		// TODO: Validate the arguments
		this.requestId = requestId;
		this.consumerId = consumerId;
		this.streamId = streamId;
		this.partition = partition;
		this.queryType = queryType;
		this.queryOptions = queryOptions;
	}
}
