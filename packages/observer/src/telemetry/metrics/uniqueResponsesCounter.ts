import { QueryResponse } from '@logsn/protocol';
import { ValueType } from '@opentelemetry/api';

import { ctx } from '../context';
import { meter } from '../globalTelemetryObjects';

/// Counter for tracking unique query responses to prevent processing duplicates.
const uniqueResponsesCounter = meter.createCounter('unique_query_responses', {
	description:
		'Total number of unique query responses, deduplicated by requestId. Based on QueryResponse system message.',
	unit: '1',
	valueType: ValueType.INT,
});

/**
 * Increment the unique responses counter.
 * This is a part of deduplication logic to keep track of unique messages processed.
 */
const addUniqueResponsesCounter = (count: number) => {
	const nodeId = ctx.nodeInfo.getStore()?.id;
	uniqueResponsesCounter.add(count, {
		nodeId,
	});
};

const NEW_MESSAGES_TIMEOUT = 30_000;
const cachedMessagesMap = new Map<string, number>();

/**
 * Determine if a response has been processed before.
 * This helps in deduplication by ensuring a message is only processed once,
 * even if received multiple times within a short timeframe.
 */
const isThisResponseMissing = (response: QueryResponse) => {
	const cachedMessage = cachedMessagesMap.get(response.requestId);
	if (cachedMessage) {
		return false;
	}

	const now = Date.now();
	cachedMessagesMap.set(response.requestId, now);
	return true;
};

/**
 * Periodically clear old entries from the cache.
 * This is essential to prevent memory leaks by removing entries that are no longer needed,
 * based on the assumption that duplicates are not expected after a certain time period.
 */
const clearOldMessages = () => {
	const now = Date.now();
	for (const [key, value] of cachedMessagesMap) {
		const difference = now - value;
		if (difference > NEW_MESSAGES_TIMEOUT) {
			cachedMessagesMap.delete(key);
		}
	}
};

setInterval(clearOldMessages, NEW_MESSAGES_TIMEOUT);

/**
 * Process a new response if it hasn't been processed before.
 * This is the main entry point for handling incoming messages,
 * ensuring deduplication and updating metrics accordingly.
 */
export const addResponseCountIfUnique = (response: QueryResponse) => {
	if (isThisResponseMissing(response)) {
		addUniqueResponsesCounter(1);
	}
};
