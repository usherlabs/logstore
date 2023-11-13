import { QueryPropagate, QueryResponse } from '@logsn/protocol';
import { EthereumAddress, toEthereumAddress } from '@streamr/utils';

import { SystemMessageValue } from '../SystemMessageObservable';
import type { SerializedMessageId } from './manageStorageMatrix';

export type PropagatedNessagesByNodeMap = Map<
	EthereumAddress,
	Set<SerializedMessageId>
>;

/**
 * This function gets the messages that are missing from the primary node.
 * It is necessary because every secondary node must warn the primary node about what messages are missing.
 */
export function getMissingPropagatedMessages({
	expectedPropagatedMessages,
	propagates,
}: {
	expectedPropagatedMessages: PropagatedNessagesByNodeMap;
	propagates: SystemMessageValue<QueryPropagate>[];
}) {
	const expectedClone = new Map(expectedPropagatedMessages);
	for (const propagate of propagates) {
		const propagatedMessages = expectedClone.get(
			toEthereumAddress(propagate.metadata.publisherId)
		);
		if (propagatedMessages) {
			for (const [messageId] of propagate.message.payload) {
				propagatedMessages.delete(messageId);
			}
		}
	}
	expectedClone.forEach((propagatedMessages, nodeAddress) => {
		if (propagatedMessages.size === 0) {
			expectedClone.delete(nodeAddress);
		}
	});
	return Array.from(expectedClone.entries());
}

/**
 * every secondary node must warn the primary node about what messages are missing
 * so if they have more messages than primary's, we flag it as expected from this address
 */
export function getExpectedPropagatedMessages({
	secondaryNodeResponses,
	primaryNodeResponse,
}: {
	secondaryNodeResponses: SystemMessageValue<QueryResponse>[];
	primaryNodeResponse: SystemMessageValue<QueryResponse>;
}): PropagatedNessagesByNodeMap {
	const primaryNodeMessages = primaryNodeResponse.message.hashMap;
	const propagatedMap = new Map() as PropagatedNessagesByNodeMap;
	for (const secondaryNodeResponse of secondaryNodeResponses) {
		const secondaryNodeMessages = secondaryNodeResponse.message.hashMap;
		const propagatedMessages = Array.from(secondaryNodeMessages.keys()).filter(
			(messageId) => !primaryNodeMessages.has(messageId)
		);
		propagatedMap.set(
			toEthereumAddress(secondaryNodeResponse.metadata.publisherId),
			new Set(propagatedMessages)
		);
	}

	return propagatedMap;
}
