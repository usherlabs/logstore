import { SystemMessageType } from '@concertodao/logstore-protocol';
import { sha256 } from '@kyvejs/protocol';
import { ethers } from 'ethers';
import redstone from 'redstone-api';

import { Managers } from '../classes/Managers';
import { BrokerNode, Report, StreamrMessage } from '../types';
import { getConfig } from '../utils/config';
import { reportPrefix } from '../utils/constants';
import { fetchResponseConsensus } from '../utils/helpers';
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

	// The previous bundle will contain the size/expense of data between the start of last bundle, and the start of this bundle.
	// Determine the finalized_bundle id by referring to the Pool's total bundles -1.
	const config = getConfig(core);
	const { fees } = config;
	// const totalBundles = parseInt(core.pool.data.total_bundles, 10);
	const expense = 0;
	// if (totalBundles > 0) {
	// 	const lastFinalizedBundleId = totalBundles - 1;
	// 	const lastBundle = await core.lcd[0].kyve.query.v1beta1.finalizedBundle({
	// 		id: `${lastFinalizedBundleId}`,
	// 		pool_id: core.pool.id,
	// 	});
	// 	const storageId = lastBundle.finalized_bundle.storage_id;
	// 	const totalBundleExpense = await Arweave.getFee(storageId); // This expense is going to be the total of all of the bytes stored.
	// 	expense = totalBundleExpense / // Expense should be relative to each byte
	// }
	const writeFee = (fees.writeMultiplier + 1) * expense;
	const writeTreasuryFee = fees.treasuryMultiplier * (writeFee - expense); // multiplier on the profit
	const writeNodeFee = writeFee - writeTreasuryFee;
	const readTreasuryFee = fees.read * fees.treasuryMultiplier;
	const readNodeFee = fees.read - readTreasuryFee;

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

	// Use events in the listener cache to determine which events are valid.
	const tsCache = core.listener.db();
	// Use events in the response cache to come to consensus on the response for  a given requet
	const responseCache = core.listener.responseDB();

	// a mapping of "contentHash => [timestamp:publisherAddr1, timestamp:publisherAddr1]"
	const queryHashKeyMap: Record<string, string[]> = {};
	const storeHashKeyMap: Record<string, [number, string][]> = {};

	const cachedItems = tsCache.getRange({
		start: fromKey,
		end: toKey,
	});

	for (const { key: lKey, value: lValue } of cachedItems) {
		if (!lValue) continue;
		for (let i = 0; i < lValue.length; i++) {
			const value = lValue[i];

			const { content, metadata } = value as StreamrMessage;
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
				// * The content should be the same across received ProofOfStoredMessage messages from all broker nodes.
				const h = sha256(Buffer.from(JSON.stringify(content)));
				// Add to storage hashMap
				// We need to consolidate the messages received in a sort of oracle manner -- ie. the majority of the nodes that shared with the query hash
				if (!storeHashKeyMap[h]) {
					storeHashKeyMap[h] = [];
				}
				storeHashKeyMap[h].push([lKey, metadata.publisherId]);
			}
		}
	}

	// lKey => timestamp and lValue => [{content1, metadata1}, {content2, metadata2}]
	for (const { key: lKey, value: lValue } of cachedItems) {
		if (!lValue) continue;
		for (const value of lValue) {
			// Iterate over each message stored at the same timestamp

			const { content, metadata } = value as StreamrMessage;
			if (!(content && metadata)) {
				continue;
			}

			const { publisherId } = metadata;
			const jointKey = `${lKey}:${publisherId}`;

			// verify that the publisher is also a broker node
			// -- despite access management being handled within the Smart Contracts, it's wise to validate here too
			const brokerNode = brokerNodes.find(
				(n) => n.id.toLowerCase() === metadata.publisherId.toLowerCase()
			);
			if (typeof brokerNode === 'undefined') {
				continue;
			}

			// ? StreamrClient Subscribe method includes publisher signature verification
			// verify the type of the content
			if (content?.messageType === SystemMessageType.QueryResponse) continue;

			const h = sha256(Buffer.from(JSON.stringify(content)));
			// * The content should be the same across received ProofOfStoredMessage and QueryRequest messages from all broker nodes.

			if (content?.messageType === SystemMessageType.QueryRequest) {
				// Add to query hashMap
				// We need to consolidate the messages received in a sort of oracle manner -- ie. the majority of the nodes that shared with the query hash
				if (!queryHashKeyMap[h]) {
					queryHashKeyMap[h] = [];
				}
				queryHashKeyMap[h].push(jointKey);
			} else {
			}
		}
	}
	core.logger.debug('HashKeyMaps: ', {
		storeHashKeyMap,
		queryHashKeyMap,
	});

	const applyFeeToDelegates = async (bNode: BrokerNode, nodeAmount: number) => {
		const delegates = Object.keys(bNode.delegates);
		for (let l = 0; l < delegates.length; l++) {
			const delAddr = delegates[l];
			const delegateAmount = await managers.node.contract.delegatesOf(
				delAddr,
				bNode.id
			);
			const delegatePortion = +delegateAmount.toString() / bNode.stake;
			if (!report.delegates[delAddr]) {
				report.delegates[delAddr] = {};
			}
			if (typeof report.delegates[delAddr][bNode.id] !== 'number') {
				report.delegates[delAddr][bNode.id] = 0;
			}
			report.delegates[delAddr][bNode.id] += delegatePortion * nodeAmount;
		}
	};

	// Apply valid storage events to report
	const storeHashKeyMapEntries = Object.entries(storeHashKeyMap);
	// get only messages which have been processed(stored) by at least half the broker nodes
	for (let i = 0; i < storeHashKeyMapEntries.length; i++) {
		const [, lKeys] = storeHashKeyMapEntries[i];
		if (lKeys.length < brokerNodes.length / 2) {
			continue;
		}
		// Add consolidated event to report
		// let event: StreamrMessage;
		const contributingPublishers = [];
		for (let j = 0; j < lKeys.length; j++) {
			const [key, publisher] = lKeys[j].split(':');
			// Determine all broker nodes that validly contributed to this event.
			// filter all the events in this timestamp owned by the publisher in question
			// reason being multiple publishers can publish multiple messages just within one timestamp x
			// thus it is important to make sure that possibility is covered
			const events = tsCache
				.get(+key)
				.filter(
					({ metadata }) => metadata.publisherId === publisher
				) as Array<StreamrMessage>;
			for (const event of events) {
				if (!event) continue;

				contributingPublishers.push(event.metadata.publisherId);
				// Stream ID is included in the system stream message.
				const { streamId: id, size, hash } = event.content;
				report.events.storage.push({
					id,
					hash,
					size,
				});
				const existingStreamIndex = report.streams.findIndex(
					(s) => s.id === id
				);
				const captureAmount = writeFee * size;
				if (existingStreamIndex < 0) {
					report.streams.push({
						id,
						capture: captureAmount,
						bytes: size,
					});
				} else {
					report.streams[existingStreamIndex].capture += captureAmount;
					report.streams[existingStreamIndex].bytes += size;
				}
				report.treasury += writeTreasuryFee * size;
				// ? All nodes managing all streams right now
				for (let j = 0; j < brokerNodes.length; j++) {
					const bNode = brokerNodes[j];
					if (typeof report.nodes[bNode.id] !== 'undefined') {
						report.nodes[bNode.id] = 0;
					}
					// Deduct from Node based on the bytes missed.
					// Use identification of publishers that validly contributed storage events to determine if current broker node was apart of that cohort.
					const nodeAmount =
						writeNodeFee *
						size *
						(contributingPublishers.includes(bNode.id.toLowerCase()) ? 1 : -1);
					report.nodes[bNode.id] += nodeAmount / brokerNodes.length;
					await applyFeeToDelegates(bNode, nodeAmount);
				}
			}
		}
	}

	// Apply valid query events to report
	const queryHashKeyMapEntries = Object.entries(queryHashKeyMap);
	for (let i = 0; i < queryHashKeyMapEntries.length; i++) {
		const [, lKeys] = queryHashKeyMapEntries[i];
		// TODO: This will never pass.
		if (lKeys.length < brokerNodes.length / 2) {
			// Clear out all hashes that the majority of the nodes did NOT "agree" with
			continue;
		}

		// Add consolidated event to report
		// lKeys => [ '1683072807034:0x4178babe9e5148c6d5fd431cd72884b07ad855a0',... ] => ['timestamp:publisher',...]
		for (let j = 0; j < lKeys.length; j++) {
			const [key, publisher] = lKeys[j].split(':');
			// get all the events made by this publisher in a given timestamp
			const events = tsCache
				.get(+key)
				.filter(
					({ metadata }) => metadata.publisherId === publisher
				) as Array<StreamrMessage>;

			for (const event of events) {
				if (!event) continue;

				// get all the responses submitted by nodes for this particular request
				const brokerResponse = responseCache.get(event.content.requestId);
				const {
					maxCount: recievedQueryResponseCount,
					maxHash: consensusHash,
					result: hashToResponses,
				} = fetchResponseConsensus(brokerResponse);
				// make sure at least hald the broker nodes agree on this response
				// which has the highest occurence
				if (recievedQueryResponseCount < brokerNodes.length / 2) continue;

				// get required information from both request and response
				const {
					consumerId: consumer,
					streamId: id,
					queryOptions: query,
				} = event.content;
				// get the first item because they should all be the same as they have the same hash
				// and we have confirmed that the length is greater than one so an item will be present
				const { hash, size } = hashToResponses[consensusHash][0].content;

				report.events.queries.push({
					id,
					query,
					consumer,
					hash,
					size,
				});
				const existingConsumerIndex = report.consumers.findIndex(
					(c) => c.id === consumer
				);

				const captureAmount = fees.read * size;
				if (existingConsumerIndex < 0) {
					report.consumers.push({
						id: consumer,
						capture: captureAmount, // the total amount of stake to capture token in wei based on the calculations
						bytes: size,
					});
				} else {
					report.consumers[existingConsumerIndex].capture += captureAmount;
					report.consumers[existingConsumerIndex].bytes += size;
				}
				report.treasury += readTreasuryFee * size;

				// ? All nodes managing all streams right now
				for (let j = 0; j < brokerNodes.length; j++) {
					const bNode = brokerNodes[j];
					if (typeof report.nodes[bNode.id] === 'undefined') {
						report.nodes[bNode.id] = 0;
					}
					const nodeAmount = readNodeFee * size;
					report.nodes[bNode.id] += nodeAmount / brokerNodes.length;
					await applyFeeToDelegates(bNode, nodeAmount);
				}
			}
		}
	}

	// Convert fees to stake token
	let priceOfStakeToken = 0.01;
	try {
		const rsResp = await redstone.getPrice(stakeToken.symbol);
		core.logger.debug('Fetched Price from Redstone', rsResp);
		priceOfStakeToken = rsResp.value;
	} catch (e) {
		core.logger.warn(`Could not fetch the Price of ${stakeToken.symbol}`);
	}
	const toStakeToken = (usdValue: number) => {
		return Math.floor(
			parseInt(
				ethers
					.parseUnits(
						// reduce precision to max allowed to prevent errors
						`${(usdValue / priceOfStakeToken).toPrecision(15)}`,
						stakeToken.decimals
					)
					.toString(10),
				10
			)
		);
	};
	report.treasury = toStakeToken(report.treasury);
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
	core.logger.debug('Report Generated', report);
	return report;
};
