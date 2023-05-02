import { sha256 } from '@kyvejs/protocol';
import { ethers } from 'ethers';
import redstone from 'redstone-api';

import { Managers } from '../classes/Managers';
import { BrokerNode, Report, StreamrMessage } from '../types';
import { Arweave } from '../utils/arweave';
import { getConfig } from '../utils/config';
import { reportPrefix } from '../utils/constants';
import Validator from '../validator';

export const produceReport = async (
	core: Validator,
	managers: Managers,
	key: string
) => {
	const config = getConfig(core);

	// 1. Use unique source to Smart Contracts to determine last accepted report
	// 2. Use last accepted report to determine range between last report and this report (using key timestamp) and query for messages

	const lastReport = await managers.report.getLastReport();
	// The start key will be the timestamp at which the validator pool is live.
	let fromKey = parseInt(core.pool.data.start_key, 10); // This needs to be the start key
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

	// Get all latest state from Smart Contract
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
	core.logger.debug('Broker Nodes: ', brokerNodes); // TODO: This is returning an empty array.
	const { fees } = config;

	// ! Re-calling all queries here to determine its size is silly.
	// The previous bundle will have the size of data between the times of the last report to the current report.
	// Determine the finalized_bundle id by referring to the Pool's total bundles -1.
	const totalBundles = parseInt(core.pool.data.total_bundles, 10);
	let expense = 0;
	if (totalBundles > 0) {
		const lastFinalizedBundleId = totalBundles - 1;
		const lastBundle = await core.lcd[0].kyve.query.v1beta1.finalizedBundle({
			id: `${lastFinalizedBundleId}`,
			pool_id: core.pool.id,
		});
		const storageId = lastBundle.finalized_bundle.storage_id;
		expense = await Arweave.getFee(storageId);
	}
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
	const listenerCache = core.listener.db();
	// a mapping of "contentHash => [timestamp:publisherAddr1, timestamp:publisherAddr1]"
	const queryHashKeyMap: Record<string, string[]> = {};
	const storeHashKeyMap: Record<string, string[]> = {};

	// @todo @dev   key is in the format "const key = `${Date.now().toString()}:${metadata.publisherId}`"";
	// can we query by getRange? because it returns empty when we do

	// test with timestamps alone to confirm it works even when teh publisher id is not attached
	// extend getrange function to abstract the concatenation of arrays
	// store it as lrange[key] = array;
	// const cachedItems = listenerCache.getRange({
	// 	start: fromKey,
	// 	end: toKey,
	// });
	// get all items in cache instead, since all items present are all we put in it
	const cachedItems = listenerCache.getRange();

	for (const { key: lKey, value: lValue } of cachedItems) {
		if (!(lValue?.content && lValue?.metadata)) {
			continue;
		}

		const { content, metadata } = lValue;
		// verify that the publisher also a broker node
		const brokerNode = brokerNodes.find(
			(n) => n.id.toLowerCase() === metadata.publisherId.toLowerCase()
		);
		if (typeof brokerNode === 'undefined') {
			continue;
		}

		// ? StreamrClient Subscribe method includes publisher signature verification

		if (content?.streamId && content?.hash && content?.size) {
			const h = sha256(Buffer.from(JSON.stringify(content))); // the content should be the same across received messages from all broker nodes.
			if (content?.queryOptions && content?.consumer) {
				// Add to query hashMap
				// We need to consolidate the messages received in a sort of oracle manner -- ie. the majority of the nodes that shared with the query hash
				if (!queryHashKeyMap[h]) {
					queryHashKeyMap[h] = [];
				}
				queryHashKeyMap[h].push(lKey);
			} else {
				// Add to storage hashMap
				// We need to consolidate the messages received in a sort of oracle manner -- ie. the majority of the nodes that shared with the query hash
				if (!storeHashKeyMap[h]) {
					storeHashKeyMap[h] = [];
				}
				storeHashKeyMap[h].push(lKey);
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
		let event: StreamrMessage;
		const contributingPublishers = [];
		for (let j = 0; j < lKeys.length; j++) {
			// Determine all broker nodes that validly contributed to this event.
			event = listenerCache.get(lKeys[j]); // All of these events for this hash will be the same.
			contributingPublishers.push(event.metadata.publisherId);
		}

		// Stream ID is included in the system stream message.
		const { streamId: id, size, hash } = event.content;
		report.events.storage.push({
			id,
			hash,
			size,
		});
		const existingStreamIndex = report.streams.findIndex((s) => s.id === id);
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
			// await applyFeeToDelegates(bNode, nodeAmount);
		}
	}

	// Apply valid query events to report
	const queryHashKeyMapEntries = Object.entries(queryHashKeyMap);
	for (let i = 0; i < queryHashKeyMapEntries.length; i++) {
		const [, lKeys] = queryHashKeyMapEntries[i];
		if (lKeys.length < brokerNodes.length / 2) {
			// Clear out all hashes that the majority of the nodes did NOT "agree" with
			continue;
		}

		// Add consolidated event to report
		const event = listenerCache.get(lKeys[0]);
		const {
			streamId: id,
			queryOptions: query,
			consumer,
			hash,
			size,
		} = event.content;
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
			if (typeof report.nodes[bNode.id] !== 'undefined') {
				report.nodes[bNode.id] = 0;
			}
			const nodeAmount = readNodeFee * size;

			report.nodes[bNode.id] += nodeAmount / brokerNodes.length;

			await applyFeeToDelegates(bNode, nodeAmount);
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
		console.log({ usdValue, priceOfStakeToken });
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
