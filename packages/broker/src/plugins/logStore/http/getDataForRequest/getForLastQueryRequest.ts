import { QueryRequest, QueryType } from '@logsn/protocol';
import { MetricsDefinition } from '@streamr/utils';
import { v4 as uuid } from 'uuid';

import { parseIntIfExists } from '../dataQueryEndpoint';
import { getMessageLimitForRequest } from '../messageLimiter';
import { LastRequest } from '../requestTypes';
import { QueryRequestBag } from './common';
import { seqNumQueryRequest } from './seqNumQueryRequestState';

const getCountForLastRequest = (req: LastRequest) => {
	const count =
		req.query.count === undefined ? 1 : parseIntIfExists(req.query.count) ?? 1;

	if (Number.isNaN(count)) {
		return 'NOT_A_NUMBER' as const;
	}

	// Added 1 because we want to know later if there are more events, so we
	// may add a metadata field to the response
	const messageLimitForARequest = getMessageLimitForRequest(req) + 1;

	return Math.min(count, messageLimitForARequest);
};

/**
 * Get QueryRequest of 'last' type from the request.
 */
export const getForLastQueryRequest = ({
	req,
	streamId,
	partition,
	metrics,
}: {
	req: LastRequest;
	streamId: string;
	partition: number;
	metrics: MetricsDefinition;
}): QueryRequestBag => {
	metrics.resendLastQueriesPerSecond.record(1);
	const count = getCountForLastRequest(req);
	if (count === 'NOT_A_NUMBER') {
		return {
			error: {
				message: `Query parameter "count" not a number: ${req.query.count}`,
			},
		};
	}

	const requestId = uuid();
	const queryRequest = new QueryRequest({
		seqNum: seqNumQueryRequest.getAndIncrement(),
		requestId,
		consumerId: req.consumer!,
		streamId,
		partition,
		queryType: QueryType.Last,
		queryOptions: {
			last: count,
		},
	});

	return { queryRequest };

	// const store = logStoreContext.getStore();
	// if (!store) {
	// 	throw new Error('Used store before it was initialized');
	// }
	// const data = store.queryRequestHandler.processQueryRequest(queryRequest);
	// return { data };
};
