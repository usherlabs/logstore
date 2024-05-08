import { MessageRef } from '@streamr/protocol';
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

/**
 * Query the latest "n" messages.
 */
export interface QueryLastOptions {
	queryType: QueryType.Last;
	last: number;
}

/**
 * Query messages starting from a given point in time.
 */
export interface QueryFromOptions {
	queryType: QueryType.From;
	from: MessageRef;
	publisherId?: string;
	limit?: number;
}

/**
 * Query messages between two points in time.
 */
export interface QueryRangeOptions {
	queryType: QueryType.Range;
	from: MessageRef;
	to: MessageRef;
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
	queryOptions: QueryOptions;
}

let messageSeqNum = 0;

export class QueryRequest extends SystemMessage {
	public readonly requestId: string;
	public readonly consumerId: string;
	public readonly streamId: string;
	public readonly partition: number;
	public readonly queryOptions: QueryOptions;

	constructor({
		version = SystemMessage.LATEST_VERSION,
		seqNum = messageSeqNum++,
		requestId,
		consumerId,
		streamId,
		partition,
		queryOptions,
	}: QueryRequestOptions) {
		super(version, SystemMessageType.QueryRequest, seqNum);

		// TODO: Validate the arguments
		this.requestId = requestId;
		this.consumerId = consumerId;
		this.streamId = streamId;
		this.partition = partition;
		this.queryOptions = queryOptions;
	}
}
