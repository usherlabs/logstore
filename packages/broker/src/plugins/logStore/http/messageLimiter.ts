import { EVENTS_PER_RESPONSE_LIMIT_ON_NON_STREAM } from './constants';
import { QueryHttpRequest } from './requestTypes';
import { isStreamRequest } from './utils';

/*
 * @dev
 * Message Limit Feature Overview:
 *
 * The message limit sets a cap on the number of messages returned in a single
 * HTTP API response. It does not apply to Server Sent Events (SSE).
 *
 * Implementation Details:
 *
 * - **HTTP API**: A transformer enforces the limit on messages in an HTTP
 *   response.
 *
 * - **Cassandra Query Handler**: Another transformer restricts the number of
 *   messages at the query level, affecting both primary and consensus nodes.
 *
 * - **Stream Control**: Readable streams stop emitting data after reaching the
 *   limit, which also stops the corresponding Cassandra write streams.
 */

export const getMessageLimitForRequest = (req: QueryHttpRequest): number => {
	return isStreamRequest(req)
		? Infinity
		: EVENTS_PER_RESPONSE_LIMIT_ON_NON_STREAM;
};
