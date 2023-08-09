import type { Stream } from '@logsn/client';
import { LogStoreClient } from '@logsn/client';
import { LogStoreNodeManager } from '@logsn/contracts';
import {
	QueryRequest,
	QueryResponse,
	SystemMessage,
	SystemMessageType,
} from '@logsn/protocol';
import { Logger } from '@streamr/utils';

import { StreamPublisher } from '../../shared/StreamPublisher';
import { StreamSubscriber } from '../../shared/StreamSubscriber';

const CONSENSUS_TIMEOUT = 30 * 1000; // 30 seconds

const logger = new Logger(module);

export type Consensus = {
	hash: string;
	signer: string;
	signature: string;
};

/**
 * On receiving a HTTP Query Request, forward the request to other Broker Nodes.
 * The wait for the Broker Network's response.
 */
export const getConsensus = async (
	queryRequest: QueryRequest,
	nodeManager: LogStoreNodeManager,
	logStoreClient: LogStoreClient,
	systemStream: Stream,
	streamPublisher: StreamPublisher
): Promise<Consensus[]> => {
	let awaitingResponses = (await nodeManager.totalNodes()).toNumber();
	const consesnusThreshold = Math.ceil(awaitingResponses / 2);
	const consensuses: Record<string, Consensus[]> = {};

	return new Promise<Consensus[]>((resolve, reject) => {
		let timeout: NodeJS.Timeout;
		const streamSubscriber = new StreamSubscriber(logStoreClient, systemStream);
		streamSubscriber
			.subscribe((msg, metadata) => {
				const systemMessage = SystemMessage.deserialize(msg);

				if (systemMessage.messageType != SystemMessageType.QueryResponse) {
					return;
				}

				const queryResponse = systemMessage as QueryResponse;
				if (queryResponse.requestId !== queryRequest.requestId) {
					return;
				}

				logger.trace(
					'Received QueryResponse: %s',
					JSON.stringify({
						requestId: queryResponse.requestId,
						publisherId: metadata.publisherId,
						hash: queryResponse.hash,
					})
				);

				if (!consensuses[queryResponse.hash]) {
					consensuses[queryResponse.hash] = [];
				}

				awaitingResponses--;
				consensuses[queryResponse.hash].push({
					hash: queryResponse.hash,
					signer: metadata.publisherId,
					signature: queryResponse.signature,
				});

				// check if consensus reached
				if (consensuses[queryResponse.hash].length >= consesnusThreshold) {
					logger.trace(
						'Consensus reached: %s',
						JSON.stringify({ requestId: queryRequest.requestId })
					);
					clearTimeout(timeout);
					streamSubscriber.unsubscribe().then(() => {
						resolve(consensuses[queryResponse.hash]);
					});
					return;
				}

				// check if consensus cannot be reached
				const leadingResponses = Object.keys(consensuses)
					.map((key) => consensuses[key].length)
					.reduce((max, length) => Math.max(max, length), 0);

				if (leadingResponses + awaitingResponses < consesnusThreshold) {
					clearTimeout(timeout);
					logger.trace(
						'No consensus: %s',
						JSON.stringify({
							requestId: queryRequest.requestId,
							consensuses,
						})
					);
					streamSubscriber.unsubscribe().then(() => {
						reject('No consensus');
					});
					return;
				}
			})
			.then(() => {
				// On successful subscription, forward the request to broker network
				streamPublisher.publish(queryRequest.serialize()).then(() => {
					logger.trace(
						'Published QueryRequest: %s',
						JSON.stringify(queryRequest)
					);

					timeout = setTimeout(() => {
						logger.trace(
							'Consensus timeout: %s',
							JSON.stringify({ requestId: queryRequest.requestId })
						);

						streamSubscriber.unsubscribe().then(() => {
							reject('Consensus timeout');
						});
					}, CONSENSUS_TIMEOUT);
				});
			})
			.catch((err) => {
				logger.error(JSON.stringify(err));
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
