import { QueryRequest, QueryType } from '@logsn/protocol';
import { MetricsDefinition } from '@streamr/utils';
import { v4 as uuid } from 'uuid';

import {
	MAX_SEQUENCE_NUMBER_VALUE,
	MIN_SEQUENCE_NUMBER_VALUE,
	parseIntIfExists,
} from '../dataQueryEndpoint';
import { getMessageLimitForRequest } from '../messageLimiter';
import { RangeRequest } from '../requestTypes';
import { QueryRequestBag } from './common';
import { seqNumQueryRequest } from './seqNumQueryRequestState';

/**
 * Get QueryRequest of 'range' type from the request.
 */
export const getForRangeQueryRequest = ({
	req,
	streamId,
	partition,
	metrics,
}: {
	req: RangeRequest;
	streamId: string;
	partition: number;
	metrics: MetricsDefinition;
}): QueryRequestBag => {
	metrics.resendRangeQueriesPerSecond.record(1);
	const fromTimestamp = parseIntIfExists(req.query.fromTimestamp);
	const toTimestamp = parseIntIfExists(req.query.toTimestamp);
	const fromSequenceNumber =
		parseIntIfExists(req.query.fromSequenceNumber) || MIN_SEQUENCE_NUMBER_VALUE;
	const toSequenceNumber =
		parseIntIfExists(req.query.toSequenceNumber) || MAX_SEQUENCE_NUMBER_VALUE;
	const { publisherId, msgChainId } = req.query;
	if (req.query.fromOffset !== undefined || req.query.toOffset !== undefined) {
		return {
			error: {
				message:
					'Query parameters "fromOffset" and "toOffset" are no longer supported. Please use "fromTimestamp" and "toTimestamp".',
			},
		};
	}
	if (fromTimestamp === undefined) {
		return { error: { message: 'Query parameter "fromTimestamp" required.' } };
	}
	if (Number.isNaN(fromTimestamp)) {
		return {
			error: {
				message: `Query parameter "fromTimestamp" not a number: ${req.query.fromTimestamp}`,
			},
		};
	}
	if (toTimestamp === undefined) {
		return {
			error: {
				message:
					'Query parameter "toTimestamp" required as well. To request all messages since a timestamp, use the endpoint /streams/:id/data/partitions/:partition/from',
			},
		};
	}
	if (Number.isNaN(toTimestamp)) {
		return {
			error: {
				message: `Query parameter "toTimestamp" not a number: ${req.query.toTimestamp}`,
			},
		};
	}
	if ((publisherId && !msgChainId) || (!publisherId && msgChainId)) {
		return {
			error: {
				message: 'Invalid combination of "publisherId" and "msgChainId"',
			},
		};
	}

	// Added 1 because we want to know later if there are more events, so we
	// may add a metadata field to the response
	const messageLimitForRequest = getMessageLimitForRequest(req) + 1;
	const limitOrUndefinedIfInfinity = isFinite(messageLimitForRequest)
		? messageLimitForRequest
		: undefined;

	const requestId = uuid();
	const queryRequest = new QueryRequest({
		seqNum: seqNumQueryRequest.getAndIncrement(),
		requestId,
		consumerId: req.consumer!,
		streamId,
		partition,
		queryType: QueryType.Range,
		queryOptions: {
			from: {
				timestamp: fromTimestamp,
				sequenceNumber: fromSequenceNumber,
			},
			to: {
				timestamp: toTimestamp,
				sequenceNumber: toSequenceNumber,
			},
			limit: limitOrUndefinedIfInfinity,
			publisherId,
			msgChainId,
		},
	});

	return { queryRequest };
};
