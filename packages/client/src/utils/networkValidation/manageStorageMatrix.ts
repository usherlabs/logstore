import { QueryResponse } from '@logsn/protocol';

import type { LogStoreMessage } from '../../LogStoreMessageStream';
import { SystemMessageValue } from '../SystemMessageObservable';

export type SerializedMessageId = string;
export type StorageMatrix = Map<
	SerializedMessageId,
	Set<{ nodeAddress: string; messageHash: string }>
>;

/**
 * @description
 * This function converts the responses into a storage matrix.
 * This is necessary because we need a structured way to store and access the responses.
 *
 * this way we can easily check if all nodes agree on the storage matrix
 * @example
 * [
 * 	['messageId1', [{nodeAddress: '0x123', messageHash: '0x456'}]],
 * 	['messageId2', [{nodeAddress: '0x123', messageHash: '0x456'}, {nodeAddress: '0x789', messageHash: '0x456'}]],
 * 	['messageId3', [{nodeAddress: '0x123', messageHash: '0x456'}]],
 * ]
 *
 */
export function convertToStorageMatrix(
	responses: SystemMessageValue<QueryResponse>[]
) {
	const storageMatrixMap: StorageMatrix = new Map();
	for (const response of responses) {
		for (const [messageId, messageHash] of response.message.hashMap) {
			const nodes = storageMatrixMap.get(messageId) ?? new Set();
			storageMatrixMap.set(
				messageId,
				nodes.add({
					nodeAddress: response.metadata.publisherId,
					messageHash,
				})
			);
		}
	}
	return storageMatrixMap;
}

export const nodesAgreeOnStorageMatrix = (
	storageMatrix: StorageMatrix
): boolean => {
	for (const [_messageId, nodes] of storageMatrix) {
		if (nodes.size === 1) {
			continue;
		}
		const nodesArray = Array.from(nodes);
		const containsDifferentHash = nodesArray.some(
			(node) => node.messageHash !== nodesArray[0].messageHash
		);
		if (containsDifferentHash) {
			return false;
		}
	}
	return true;
};

export const verifyMessagePresenceInStorageMatrix = ({
	messagesFromHttpResponse,
	storageMatrix,
}: {
	messagesFromHttpResponse: LogStoreMessage[];
	storageMatrix: ReturnType<typeof convertToStorageMatrix>;
}) => {
	const storageMatrixCountPerMessageID = new Map<SerializedMessageId, number>();
	storageMatrix.forEach((nodesThatContain, messageId) => {
		storageMatrixCountPerMessageID.set(messageId, nodesThatContain.size);
	});

	// each message is present in at least one node, not every
	return messagesFromHttpResponse.every((msg) => {
		const id = msg.metadata.id.serialize();
		const count = storageMatrixCountPerMessageID.get(id) ?? 0;
		return count > 0;
	});
};
