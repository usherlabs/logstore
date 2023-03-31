import { ethers } from 'ethers';
import redstone from 'redstone-api';
import { fromString } from 'uint8arrays/from-string';

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
		const rKey = lastReport.id.substring(
			reportPrefix.length,
			lastReport.id.length
		);
		fromKey = parseInt(rKey, 10);
	}
	const toKey = parseInt(key.substring(reportPrefix.length, key.length), 10);

	// Get all latest state from Smart Contract
	// We do this by using the key (timestamp) to determine the most relevant block
	const blockNumber = await managers.getBlockByTime(toKey);
	// Now that we have the block that most closely resemble the current key
	const stakeToken = await managers.node.getStakeToken(blockNumber);
	// // Fetch all Smart Contract events to reconstruct the state
	// const stores = await managers.store.getStores(blockNumber);
	// Produce brokerNode list by starting at headNode and iterating over nodes.
	const brokerNodes = await managers.node.getBrokerNodes(blockNumber);

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
	const listenerCache = await core.listener.db();
	const queryHashKeyMap: Record<string, string[]> = {};
	const storeHashKeyMap: Record<string, string[]> = {};
	for await (const [lKey, lValue] of listenerCache.iterator({
		gte: fromKey,
		lt: toKey,
	})) {
		// verify that the publisher also a broker node
		const brokerNode = brokerNodes.find((n) => n.id === metadata.publisherId);
		if (typeof brokerNode === 'undefined') {
			continue;
		}
		if (brokerNode.stake < stakeToken.minRequirement) {
			continue;
		}

		const { content, metadata } = lValue;
		const sKey = `${lKey}`;
		const keySplit = sKey.split(':');
		let streamId = '';
		if (keySplit.length > 1) {
			streamId = keySplit[1];
		}
		if (
			streamId === core.queryStreamId &&
			content?.query &&
			content?.nonce &&
			content?.consumer &&
			content?.sig &&
			content?.hash &&
			content?.size
		) {
			// TODO: Ensure variables match that of the Broker Node

			// This is a proof-of-event for a query
			// verify the consumer signature
			const consumerHash = ethers.keccak256(
				fromString(JSON.stringify(content.query) + content.nonce)
			);
			const signerAddr = ethers.verifyMessage(consumerHash, content.sig);
			if (signerAddr !== content.consumer) {
				continue;
			}

			// Add to query hashMap
			// We need to consolidate the messages received in a sort of oracle manner -- ie. the majority of the nodes that shared with the query hash
			const h = content.consumer + ':' + content.hash;
			if (!queryHashKeyMap[h]) {
				queryHashKeyMap[h] = [];
			}
			queryHashKeyMap[h].push(sKey);
		}
		if (streamId === core.systemStreamId && content?.hash && content?.size) {
			// TODO: Ensure variables match that of the Broker Node

			// Add to storage hashMap
			// We need to consolidate the messages received in a sort of oracle manner -- ie. the majority of the nodes that shared with the query hash
			const h = content.hash;
			if (!storeHashKeyMap[h]) {
				storeHashKeyMap[h] = [];
			}
			storeHashKeyMap[h].push(sKey);
		}
	}

	const applyFeeToDelegates = async (bNode: BrokerNode, nodeAmount: number) => {
		for (let l = 0; l < bNode.delegates.length; l++) {
			const delAddr = bNode.delegates[l];
			const delegateAmount = await managers.node.contract.delegatesOf(
				delAddr,
				bNode.id
			);
			const delegatePortion = delegateAmount / bNode.stake;
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
	for (let i = 0; i < storeHashKeyMapEntries.length; i++) {
		const [, lKeys] = storeHashKeyMapEntries[i];
		if (lKeys.length < brokerNodes.length / 2) {
			continue;
		}

		// Add consolidated event to report
		let event = null;
		const contributingPublishers = [];
		for (let j = 0; j < lKeys.length; j++) {
			// Determine all broker nodes that validly contributed to this event.
			event = (await listenerCache.get(lKeys[j])) as StreamrMessage; // All of these events for this hash will be the same.
			contributingPublishers.push(event.metadata.publisherId);
		}

		const id = event.metadata.streamId.toString();
		report.events.storage.push({
			id,
			hash: event.content.hash,
			size: event.content.size,
		});

		const existingStreamIndex = report.streams.findIndex((s) => s.id === id);
		const captureAmount = writeFee * event.content.size;
		if (existingStreamIndex < 0) {
			report.streams.push({
				id,
				capture: captureAmount,
				bytes: event.content.size,
			});
		} else {
			report.streams[existingStreamIndex].capture += captureAmount;
			report.streams[existingStreamIndex].bytes += event.content.size;
		}
		report.treasury += writeTreasuryFee * event.content.size;

		// ? All nodes managing all streams right now
		for (let j = 0; j < brokerNodes.length; j++) {
			const bNode = brokerNodes[j];
			if (bNode.stake < stakeToken.minRequirement) {
				continue;
			}
			if (typeof report.nodes[bNode.id] !== 'undefined') {
				report.nodes[bNode.id] = 0;
			}

			// Deduct from Node based on the bytes missed.
			// Use identification of publishers that validly contributed storage events to determine if current broker node was apart of that cohort.
			const nodeAmount =
				writeNodeFee *
				event.content.size *
				(contributingPublishers.includes(bNode.id) ? 1 : -1);

			report.nodes[bNode.id] += nodeAmount / brokerNodes.length;

			await applyFeeToDelegates(bNode, nodeAmount);
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
		const event = await listenerCache.get(lKeys[0]);
		const id = event.metadata.streamId.toString();
		report.events.queries.push({
			id,
			query: event.content.query,
			nonce: event.content.nonce,
			consumer: event.content.consumer,
			hash: event.content.hash,
			size: event.content.size,
		});
		const existingConsumerIndex = report.consumers.findIndex(
			(c) => c.id === event.content.consumer
		);

		const captureAmount = fees.read * event.content.size;
		if (existingConsumerIndex < 0) {
			report.consumers.push({
				id: event.content.consumer,
				capture: captureAmount, // the total amount of stake to capture token in wei based on the calculations
				bytes: event.content.size,
			});
		} else {
			report.consumers[existingConsumerIndex].capture += captureAmount;
			report.consumers[existingConsumerIndex].bytes += event.content.size;
		}
		report.treasury += readTreasuryFee * event.content.size;

		// ? All nodes managing all streams right now
		for (let j = 0; j < brokerNodes.length; j++) {
			const bNode = brokerNodes[j];
			if (bNode.stake < stakeToken.minRequirement) {
				continue;
			}
			if (typeof report.nodes[bNode.id] !== 'undefined') {
				report.nodes[bNode.id] = 0;
			}
			const nodeAmount = readNodeFee * event.content.size;

			report.nodes[bNode.id] += nodeAmount / brokerNodes.length;

			await applyFeeToDelegates(bNode, nodeAmount);
		}
	}

	// Convert fees to stake token
	let priceOfStakeToken = 0.01;
	try {
		const rsResp = await redstone.getPrice(stakeToken.symbol);
		priceOfStakeToken = rsResp.value;
	} catch (e) {
		core.logger.warn(`Could not fetch the Price of ${stakeToken.symbol}`);
	}
	const toStakeToken = (usdValue: number) =>
		Math.floor(
			parseInt(
				ethers
					.parseUnits(`${usdValue / priceOfStakeToken}`, stakeToken.decimals)
					.toString(10),
				10
			)
		);
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

	return report;
};
