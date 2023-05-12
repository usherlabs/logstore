import { SystemMessageType } from '@concertodao/logstore-protocol';
import { sha256 } from '@kyvejs/protocol';

import { Managers } from '../classes/Managers';
import { Report } from '../types';
import { Arweave } from '../utils/arweave';
import { getConfig } from '../utils/config';
import { reportPrefix } from '../utils/constants';
import {
	convertToStakeToken,
	fetchQueryResponseConsensus,
} from '../utils/helpers';
import Validator from '../validator';

export const produceReport = async (
	core: Validator,
	managers: Managers,
	key: string
) => {
	// 1. Use Smart Contracts to determine last accepted report
	// 2. Use last accepted report to determine range between last report and this report (using key timestamp) and query for messages

	const lastReport = await managers.report.getLastReport();
	// The start key will be the timestamp at which the Kyve Pool is created.
	let fromKey = parseInt(core.pool.data.start_key, 10); // This defaults to be the Pool's start key
	if ((lastReport || {})?.id) {
		core.logger.debug('Last Report Id: ', lastReport.id);
		const rKey = lastReport.id.substring(
			reportPrefix.length,
			lastReport.id.length
		);
		fromKey = parseInt(rKey, 10);
	}
	const toKey = parseInt(key.substring(reportPrefix.length, key.length), 10);
	core.logger.debug('Report Range: ', { fromKey, toKey });

	// Get all state from Smart Contract up to the current key (where key = block at a timestamp)
	// We do this by using the key (timestamp) to determine the most relevant block
	// ? We need to get the closest block because it may not be the most recent block...
	core.logger.debug('getBlockByTime...');
	const block = await managers.getBlockByTime(toKey);
	const blockNumber = block.number;
	core.logger.debug('Block Number: ', {
		blockNumber,
	});

	// Now that we have the block that most closely resemble the current key
	const stakeToken = await managers.node.getStakeToken(blockNumber);
	// Produce brokerNode list by starting at headNode and iterating over nodes.
	const brokerNodes = await managers.node.getBrokerNodes(
		blockNumber,
		stakeToken.minRequirement
	);
	core.logger.debug('Broker Nodes: ', brokerNodes);

	// Get fees from config
	const config = getConfig(core);
	const { fees } = config;

	// Establish the report
	const report: Report = {
		id: key,
		height: blockNumber,
		treasury: 0,
		streams: [],
		consumers: [],
		nodes: {},
		delegates: {},
		events: {
			queries: [],
			storage: [],
		},
	};

	// ------------ SETUP UTILS ------------
	// This method works by distributing a total captured fee amount to a set of nodes.
	// The report yields a difference in node's balance (positive or negative) to apply to the balance on-chain
	// ie. If the report indicates a node value is X, then increment the balance by X, otherwise if value is -Y, then decrement the balance by Y
	const rewardNodes = (
		amount: number,
		recipients: string[],
		penalise: boolean
	) => {
		// ? All nodes managing all streams right now
		// -- In the future, we would determine the Broker Sub-network relevant to the stream

		const amountPerNode = amount / brokerNodes.length;
		const bystanders = brokerNodes
			.map((b) => b.id)
			.filter((id) => !recipients.includes(id));
		let rewardPerRecipient = 0;
		if (penalise) {
			rewardPerRecipient =
				amountPerNode + (amountPerNode * bystanders.length) / recipients.length; // base reward per node + rewards deducted from bystanders shared between recipients
		} else {
			rewardPerRecipient = amount / recipients.length;
		}

		for (let j = 0; j < brokerNodes.length; j++) {
			const bNode = brokerNodes[j];

			if (typeof report.nodes[bNode.id] !== 'undefined') {
				report.nodes[bNode.id] = 0;
			}

			// Add change in balance to node stake
			let balanceDifference = 0;
			if (recipients.includes(bNode.id)) {
				balanceDifference = rewardPerRecipient;
			} else if (penalise && bystanders.includes(bNode.id)) {
				balanceDifference = -amountPerNode;
			}
			report.nodes[bNode.id] += balanceDifference;

			// Distributed incremented fee across delegates of node proportional to their stake distribution
			const delegates = Object.entries(bNode.delegates);
			for (let l = 0; l < delegates.length; l++) {
				const [delegateAddr, delegateAmount] = delegates[l];
				const delegatePortion = delegateAmount / bNode.stake;
				if (!report.delegates[delegateAddr]) {
					report.delegates[delegateAddr] = {};
				}
				if (typeof report.delegates[delegateAddr][bNode.id] !== 'number') {
					report.delegates[delegateAddr][bNode.id] = 0;
				}
				report.delegates[delegateAddr][bNode.id] +=
					delegatePortion * balanceDifference;
			}
		}
	};
	// ------------------------------------

	// ------------ STORAGE ------------
	// Use events in the listener cache to determine which events are valid.
	const storeCache = core.listener.storeDb();
	// a mapping of "contentHash => [[timestamp, valueIndex], [timestamp, valueIndex]]"
	// With this mapping, we can determine which events in the storeCache pertain to the ProofOfMessageStored hash - and therefore which publishers/brokers contributed.
	const storeHashKeyMap: Record<string, [number, number][]> = {};
	const storeCachedItems = storeCache.getRange({
		start: fromKey,
		end: toKey,
	});
	for (const { key: cacheKey, value: cacheValue } of storeCachedItems) {
		if (!cacheValue) continue;
		for (let i = 0; i < cacheValue.length; i++) {
			const value = cacheValue[i];

			const { content, metadata } = value;
			if (!(content && metadata)) {
				continue;
			}

			// verify that the publisher is also a broker node
			// -- despite access management being handled within the Smart Contracts, it's wise to validate here too
			const brokerNode = brokerNodes.find(
				(n) => n.id.toLowerCase() === metadata.publisherId.toLowerCase()
			);
			if (typeof brokerNode === 'undefined') {
				continue;
			}

			if (content?.messageType === SystemMessageType.ProofOfMessageStored) {
				// * The content should be the same for all ProofOfStoredMessage messages received, for a given stored message.
				// We use a hash to consolidate the messages received, whereby the value references the list of single events received each broker on the broker network
				const h = sha256(Buffer.from(JSON.stringify(content)));
				if (!storeHashKeyMap[h]) {
					storeHashKeyMap[h] = [];
				}
				// The key here will referece a specific event within the store cache using the key/index
				storeHashKeyMap[h].push([cacheKey, i]);
			}
		}
	}
	core.logger.debug('Storage HashKeyMap: ', {
		storeHashKeyMap,
	});

	// Apply valid storage events to report
	const streamsMap: Record<string, { bytes: number; contributors: string[] }> =
		{};
	const storeHashKeyMapEntries = Object.entries(storeHashKeyMap);
	for (let i = 0; i < storeHashKeyMapEntries.length; i++) {
		const [, storeKeys] = storeHashKeyMapEntries[i];
		// use only messages which have been processed(stored) by at least half the broker nodes
		if (storeKeys.length < brokerNodes.length / 2) {
			continue;
		}

		// Add consolidated events to report
		// ? Fees are determined after the report has been populated by the event data
		const contributingPublishers = [];
		for (let j = 0; j < storeKeys.length; j++) {
			const [key, valueIndex] = storeKeys[j];
			const event = storeCache.get(key)[valueIndex];
			if (!event) continue;

			// Now, we're iterating over each specific proofOfMessageStored event published by each Broker on the Broker Network

			contributingPublishers.push(event.metadata.publisherId);
			// Stream ID is included in the system stream message.
			const { streamId: id, size, hash } = event.content;
			report.events.storage.push({
				id,
				hash,
				size,
			});

			if (typeof streamsMap[id] === 'undefined') {
				streamsMap[id] = {
					bytes: size,
					contributors: [event.metadata.publisherId],
				};
			} else {
				streamsMap[id].bytes += size;
				streamsMap[id].contributors.push(event.metadata.publisherId);
			}
		}
	}

	const streamsMapEntries = Object.entries(streamsMap);

	// Determine the Storage Fee per Byte
	const totalBytesStored = streamsMapEntries.reduce((totalBytes, curr) => {
		const [, { bytes }] = curr;
		totalBytes += bytes;
		return totalBytes;
	}, 0);
	const expensePerByteStored = await Arweave.getPrice(totalBytesStored);
	const writeFee = (fees.writeMultiplier + 1) * expensePerByteStored;
	const writeTreasuryFee =
		fees.treasuryMultiplier * (writeFee - expensePerByteStored); // multiplier on the margin
	const writeNodeFee = writeFee - writeTreasuryFee;

	// Hydrate the report with storage data
	for (let i = 0; i < streamsMapEntries.length; i++) {
		const [streamId, { bytes, contributors }] = streamsMapEntries[i];

		const capture = writeFee * bytes;
		report.streams.push({
			id: streamId,
			capture,
			bytes,
		});
		report.treasury += writeTreasuryFee * bytes;

		// Deduct from Node based on the bytes missed.
		// Use identification of publishers that validly contributed storage events to determine if current broker node was apart of that cohort.
		rewardNodes(writeNodeFee * bytes, contributors, true);
	}
	// ------------ END STORAGE ------------
	// -------------------------------------

	// ------------ QUERIES ----------------
	const queryRequestCache = core.listener.queryRequestDb();
	const queryResponseCache = core.listener.queryResponseDb();
	// Iterate over the query-request events between the range
	const queryRequestCachedItems = queryRequestCache.getRange({
		start: fromKey,
		end: toKey,
	});

	// Determine read fees
	const { read: readFee } = fees;
	const readTreasuryFee = readFee * fees.treasuryMultiplier;
	const readNodeFee = readFee - readTreasuryFee;

	for (const { value: cacheValue } of queryRequestCachedItems) {
		if (!cacheValue) continue;
		for (let i = 0; i < cacheValue.length; i++) {
			// Here, we iterate over the query requests that may have occured during the same timestamp
			const value = cacheValue[i];

			const { content, metadata } = value;
			if (!(content && metadata)) {
				continue;
			}

			const queryResponsesForRequest = queryResponseCache.get(
				content.requestId
			);
			const {
				// maxCount: consensusCount,
				maxHash: consensusHash,
				result: queryResponseHashMap,
			} = fetchQueryResponseConsensus(queryResponsesForRequest);

			// get data for response that has the highest consensus
			//  -- In the future, we can penalise nodes for not meeting a threshold of >=50% of the responses

			// get the first item because they should all be the same as they have the same hash
			// and we have confirmed that the length is greater than one so an item will be present
			const { hash, size } = queryResponseHashMap[consensusHash][0].content;

			report.events.queries.push({
				id: content.streamId,
				query: content.queryOptions,
				consumer: content.consumerId,
				hash,
				size,
			});
			const existingConsumerIndex = report.consumers.findIndex(
				(c) => c.id === content.consumerId
			);

			const captureAmount = readFee * size;
			if (existingConsumerIndex < 0) {
				report.consumers.push({
					id: content.consumerId,
					capture: captureAmount, // the total amount of stake to capture token in wei based on the calculations
					bytes: size,
				});
			} else {
				report.consumers[existingConsumerIndex].capture += captureAmount;
				report.consumers[existingConsumerIndex].bytes += size;
			}
			report.treasury += readTreasuryFee * size;

			// Only apply fees to nodes that have contributed to the conensus response
			const contributors = queryResponseHashMap[consensusHash].map(
				(msg) => msg.metadata.publisherId
			);
			rewardNodes(readNodeFee * size, contributors, false);
		}
	}
	// ------------ END QUERIES ------------
	// -------------------------------------

	// ------------ FEE CONVERSION ------------
	// Convert fees to stake token
	const stakeTokenPrice = await core.getTokenPrice(stakeToken.symbol);
	core.logger.debug('Fetched Price from Oracle', stakeTokenPrice);
	const toStakeToken = convertToStakeToken(
		stakeTokenPrice,
		stakeToken.decimals
	);
	report.treasury = toStakeToken(report.treasury);
	report.streams = report.streams.map((s) => {
		s.capture = toStakeToken(s.capture);
		return s;
	});
	report.consumers = report.consumers.map((c) => {
		c.capture = toStakeToken(c.capture);
		return c;
	});
	Object.keys(report.nodes).forEach((n) => {
		report.nodes[n] = toStakeToken(report.nodes[n]);
	});
	Object.keys(report.delegates).forEach((d) => {
		Object.keys(report.delegates[d]).forEach((n) => {
			report.delegates[d][n] = toStakeToken(report.delegates[d][n]);
		});
	});
	// ------------ END FEE CONVERSION ------------
	// -------------------------------------

	core.logger.debug('Report Generated', report);

	return report;
};
