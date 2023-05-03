import { LogStoreClient } from '@concertodao/logstore-client';
import { LogStoreNodeManager } from '@concertodao/logstore-contracts';
import {
	QueryRequest,
	QueryResponse,
	SystemMessage,
	SystemMessageType,
} from '@concertodao/logstore-protocol';
import { Logger } from '@streamr/utils';
import { Signer } from 'ethers';
import { keccak256 } from 'ethers/lib/utils';
import { Readable } from 'stream';
import type { Stream, StreamMessage, Subscription } from 'streamr-client';

const logger = new Logger(module);

export type Consensus = {
	hash: string;
	signer: string;
	signature: string;
};

export const hashResponse = async (id: string, data: Readable) => {
	let size = 0;
	let hash = keccak256(Uint8Array.from(Buffer.from(id)));
	for await (const chunk of data) {
		const streamMessage = chunk as StreamMessage;
		const content = streamMessage.getContent(false);
		size += Buffer.byteLength(content, 'utf8');
		hash = keccak256(Uint8Array.from(Buffer.from(hash + content)));
	}
	hash = keccak256(Uint8Array.from(Buffer.from(hash + size)));
	return { size, hash };
};

/**
 * On receiving a HTTP Query Request, forward the request to other Broker Nodes.
 * The wait for the Broker Network's response.
 */
export const getConsensus = async (
	queryRequest: QueryRequest,
	nodeManager: LogStoreNodeManager,
	logStoreClient: LogStoreClient,
	signer: Signer,
	systemStream: Stream,
	data: Readable
): Promise<Consensus[]> => {
	const CONSENSUS_TIMEOUT = 10 * 1000; // 10 seconds
	const CONSENSUS_THRESHOLD = (await nodeManager.totalNodes()).toNumber();

	const { size, hash } = await hashResponse(queryRequest.requestId, data);
	const signature = await signer.signMessage(hash);
	const consensus: Consensus[] = [];

	return new Promise<Consensus[]>((resolve, reject) => {
		let timeout: NodeJS.Timeout;
		let sub: Subscription;
		logStoreClient
			.subscribe(systemStream, (msg, metadata) => {
				const systemMessage = SystemMessage.deserialize(msg);

				if (systemMessage.messageType != SystemMessageType.QueryResponse) {
					return;
				}

				const queryResponse = systemMessage as QueryResponse;
				if (queryResponse.requestId != queryRequest.requestId) {
					return;
				}

				// TODO: Currently, rejects once an incorrect hash received. Will need to eventually update to manage a count of mismatches
				// It should collect majority of hashes to reach a consesnsus.
				if (queryResponse.size != size && queryResponse.hash != hash) {
					clearTimeout(timeout);
					sub.unsubscribe().then(() => {
						reject('No consensus');
					});
					return;
				}

				consensus.push({
					hash: queryResponse.hash,
					signer: metadata.publisherId,
					signature: queryResponse.signature,
				});

				if (consensus.length >= CONSENSUS_THRESHOLD) {
					clearTimeout(timeout);
					sub.unsubscribe().then(() => {
						resolve(consensus);
					});
					return;
				}
			})
			.then((subscription) => {
				// save subscription for clean up
				sub = subscription;

				// On successful subscription, forward the request to broker network
				logStoreClient
					.publish(systemStream, queryRequest.serialize())
					.then(() => {
						timeout = setTimeout(() => {
							sub.unsubscribe().then(() => {
								reject('Consensus timeout');
							});
						}, CONSENSUS_TIMEOUT);
					});

				// ? On the query request, the Broker Node is required to emit a response so that validators can ensure it also is producing the correct response.
				const queryResponse = new QueryResponse({
					requestId: queryRequest.requestId,
					size,
					hash,
					signature,
				});
				logStoreClient.publish(systemStream, queryResponse.serialize()).then();
			})
			.catch((err) => {
				logger.error(err);
				clearTimeout(timeout);
				reject(err``);
			});
	});

	///
	// 1. Iterate over all the items in data readable
	// 2. hash each of them, prepending the previous hash -- ie.
	// hash = keccak256(fromStringToUint8Array(toString(hash) + data[i].message))
	// size = size + Buffer.byteLength(data[i].message);
	// 3. Ship the message over the system stream
	// 4. Await messages to be received via the system stream listner
	// 5. Compare local metadata to received metadata
	// 6. Collate all system publisher ids, signatures and hashhes and include them as items in the readable stream.... -- if this is possible...
	// Send the response
};
