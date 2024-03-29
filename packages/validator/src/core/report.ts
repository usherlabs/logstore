import { SystemReport } from '@logsn/protocol';
import Decimal from 'decimal.js';

import { Managers } from '../managers';
// import { rollingConfig } from '../shared/rollingConfig';
import { IBrokerNode, IValidatorReport } from '../types';
// import { Arweave } from '../utils/arweave';
// import { fetchQueryResponseConsensus } from '../utils/helpers';
import { ReportUtils } from '../utils/report';
import { StakeToken } from '../utils/stake-token';
import { AbstractDataItem } from './abstract';

interface IPrepared {
	fromKey: number;
	toKey: number;
	blockNumber: number;
	stakeToken: StakeToken;
	brokerNodes: IBrokerNode[];
}

export class Report extends AbstractDataItem<IPrepared> {
	prepared: IPrepared;

	override async load(managers: Managers) {
		const { core, fromKey: fromKeyStr, toKey: toKeyStr } = this;
		const fromKey = parseInt(fromKeyStr, 10);
		const toKey = parseInt(toKeyStr, 10);
		core.logger.debug('Report Range:', JSON.stringify({ fromKey, toKey }));

		if (toKey === 0) {
			return {
				fromKey: 0,
				toKey: 0,
				blockNumber: 0,
				stakeToken: undefined,
				brokerNodes: [],
			};
		}

		// Get all state from Smart Contract up to the current key (where key = block at a timestamp)
		// We do this by using the key (timestamp) to determine the most relevant block
		// ? We need to get the closest block because it may not be the most recent block...
		core.logger.debug('getBlockByTime...');
		const fromBlockNumber = await this.runtime.startBlockNumber();
		const toBlockNumber = await this.runtime.time.find(toKey);
		core.logger.debug(
			'Block Number:',
			JSON.stringify({
				blockNumber: toBlockNumber,
			})
		);

		// Now that we have the block that most closely resemble the current key
		const stakeToken = await managers.node.getStakeToken(toBlockNumber);
		// Produce brokerNode list by starting at headNode and iterating over nodes.
		const brokerNodes = await managers.node.getBrokerNodes(
			fromBlockNumber,
			toBlockNumber,
			stakeToken.minRequirement
		);
		core.logger.debug('Broker Nodes:', JSON.stringify(brokerNodes));

		return {
			fromKey,
			toKey,
			blockNumber: toBlockNumber,
			stakeToken,
			brokerNodes,
		};
	}

	public async generate(): Promise<SystemReport> {
		const {
			// TODO use again on 0.0.3 implementation
			fromKey: _fromKey,
			toKey: _toKey,
			blockNumber,
			// TODO use again on 0.0.3 implementation
			brokerNodes: _brokerNodes,
			stakeToken: _stakeToken,
		} = this.prepared;

		const {
			core,
			// TODO use again on 0.0.3 implementation
			// runtime: { listener },
			toKey: keyStr,
			// TODO use again on 0.0.3 implementation
			// config: { fees },
		} = this;

		// const fromKeyMs = (fromKey - rollingConfig(fromKey).prev.keyStep) * 1000;
		// const toKeyMs = toKey * 1000;

		// Establish the report
		const report: IValidatorReport = {
			id: keyStr,
			height: blockNumber,
			treasury: new Decimal(0),
			streams: [],
			consumers: [],
			nodes: {},
			delegates: {},
			events: {
				queries: [],
				storage: [],
			},
		};

		if (keyStr === '0') {
			return ReportUtils.finalise(report);
		}

		// ------------ SETUP UTILS ------------
		// This method works by distributing a total captured fee amount to a set of nodes.
		// The report yields a difference in node's balance (positive or negative) to apply to the balance on-chain
		// ie. If the report indicates a node value is X, then increment the balance by X, otherwise if value is -Y, then decrement the balance by Y
		// ------------ SETUP UTILS ------------
		// This method works by distributing a total captured fee amount to a set of nodes.
		// The report yields a difference in node's balance (positive or negative) to apply to the balance on-chain
		// ie. If the report indicates a node value is X, then increment the balance by X, otherwise if value is -Y, then decrement the balance by Y
		// const rewardNodes = (
		// 	amount: Decimal,
		// 	recipients: string[],
		// 	penalise: boolean
		// ) => {
		// 	// ? All nodes managing all streams right now
		// 	// -- In the future, we would determine the Broker Sub-network relevant to the stream

		// 	const amountPerNode = amount.div(brokerNodes.length);
		// 	const bystanders = brokerNodes
		// 		.map((b) => b.id)
		// 		.filter((id) => !recipients.includes(id));
		// 	let rewardPerRecipient = new Decimal(0);
		// 	if (penalise) {
		// 		// base reward per node + rewards deducted from bystanders shared between recipients
		// 		rewardPerRecipient = amountPerNode.add(
		// 			amountPerNode.mul(bystanders.length).div(recipients.length)
		// 		);
		// 	} else {
		// 		rewardPerRecipient = amount.div(recipients.length);
		// 	}

		// 	for (let j = 0; j < brokerNodes.length; j++) {
		// 		const bNode = brokerNodes[j];

		// 		if (typeof report.nodes[bNode.id] !== 'number') {
		// 			report.nodes[bNode.id] = new Decimal(0);
		// 		}

		// 		// Add change in balance to node stake
		// 		let balanceDifference = new Decimal(0);
		// 		if (recipients.includes(bNode.id)) {
		// 			balanceDifference = rewardPerRecipient;
		// 		} else if (penalise && bystanders.includes(bNode.id)) {
		// 			balanceDifference = amountPerNode.mul(-1);
		// 		}
		// 		report.nodes[bNode.id] = report.nodes[bNode.id].add(balanceDifference);

		// 		// Distributed incremented fee across delegates of node proportional to their stake distribution
		// 		const delegates = Object.entries(bNode.delegates);
		// 		for (let l = 0; l < delegates.length; l++) {
		// 			const [delegateAddr, delegateAmountBN] = delegates[l];
		// 			const delegateAmount = new Decimal(delegateAmountBN.toHexString());
		// 			const bNodeStake = new Decimal(bNode.stake.toHexString());
		// 			const delegatePortion = delegateAmount.div(bNodeStake);
		// 			if (typeof report.delegates[delegateAddr] === 'undefined') {
		// 				report.delegates[delegateAddr] = {};
		// 			}
		// 			if (typeof report.delegates[delegateAddr][bNode.id] !== 'number') {
		// 				report.delegates[delegateAddr][bNode.id] = new Decimal(0);
		// 			}
		// 			report.delegates[delegateAddr][bNode.id] = report.delegates[
		// 				delegateAddr
		// 			][bNode.id].add(balanceDifference.mul(delegatePortion));
		// 		}
		// 	}
		// };
		// ------------------------------------

		// ------------ STORAGE ------------
		// TODO:	Report should:
		//				On storage
		//				1. Query messages from a broker, and to know if each of them is valid
		// pseudo
		// const currentMessages = this.getMessagesFromBroker({fromTimestamp, toTimestamp})
		// const [validMessages, invalidMessages] = this.validateMessages(currentMessages)
		// this.includeValidMessagesInformationOnReport({validMessages, invalidMessages})

		// FIXME:
		//				Old way:
		//				- Identifies and groups ProofOfMessageStored events from storage.
		// 				- Verifies acknowledgement by a sufficient number of broker nodes.
		// 				- Aggregates relevant data such as stream ID and storage size.
		// 				- Calculates total storage fee based on total bytes stored and Arweave's pricing.
		// 				- Breaks down the fee into treasury and node fees.
		// 				- Populates the report with aggregated storage data, calculated fees, and node rewards or deductions based on their contributions to the storage events.
		//				.
		//				Important outcomes from old way:
		//				Aggregated Storage Data:
		//				- Total bytes stored.
		//				- Stream IDs and corresponding storage sizes.
		//				- Contributing publishers or broker nodes for each storage event.
		//				Calculated Fees:
		//				- Total storage fee.
		//				- Fee breakdown between treasury and nodes.
		//				Node Rewards or Deductions:
		//				- Rewards or deductions for each node based on their contributions to the storage events.

		// FIXME:
		// 			Commented out because it depends on MessageStoredProof

		// 		// Use events in the listener cache to determine which events are valid.
		// 		const storeCache = listener.db.storeDb();
		// 		// a mapping of "contentHash => [[timestamp, valueIndex], [timestamp, valueIndex]]"
		// 		// With this mapping, we can determine which events in the storeCache pertain to the ProofOfMessageStored hash - and therefore which publishers/brokers contributed.
		// 		const storeHashKeyMap: Record<string, [number, number][]> = {};
		// 		const storeCachedItems = storeCache.getRange({
		// 			start: fromKeyMs,
		// 			end: toKeyMs,
		// 		});
		// 		// TODO: We may need to create a special cache for streamIds that are complete dropped during a given item cycle.
		// 		for (const { key: cacheKey, value: cacheValue } of storeCachedItems) {
		// 			if (!cacheValue) continue;
		// 			for (let i = 0; i < cacheValue.length; i++) {
		// 				const value = cacheValue[i];
		//
		// 				const { content, metadata } = value.message;
		// 				if (!(content && metadata)) {
		// 					continue;
		// 				}
		//
		// 				// verify that the publisher is also a broker node
		// 				// -- despite access management being handled within the Smart Contracts, it's wise to validate here too
		// 				const brokerNode = brokerNodes.find(
		// 					(n) => n.id.toLowerCase() === metadata.publisherId.toLowerCase()
		// 				);
		// 				if (typeof brokerNode === 'undefined') {
		// 					continue;
		// 				}
		//
		// 				if (content?.messageType === SystemMessageType.ProofOfMessageStored) {
		// 					// * The content should be the same for all ProofOfStoredMessage messages received, for a given stored message.
		// 					// We use a hash to consolidate the messages received, whereby the value references the list of single events received each broker on the broker network
		// 					const h = sha256(Buffer.from(JSON.stringify(content)));
		// 					if (!storeHashKeyMap[h]) {
		// 						storeHashKeyMap[h] = [];
		// 					}
		// 					// The key here will referece a specific event within the store cache using the key/index
		// 					storeHashKeyMap[h].push([cacheKey, i]);
		// 				}
		// 			}
		// 		}
		// 		core.logger.debug('Storage HashKeyMap:', JSON.stringify(storeHashKeyMap));
		//
		// 		// Apply valid storage events to report
		// 		const streamsMap: Record<
		// 			string,
		// 			{ bytes: number; contributors: string[] }
		// 		> = {};
		// 		const storeHashKeyMapEntries = Object.entries(storeHashKeyMap);
		// 		for (let i = 0; i < storeHashKeyMapEntries.length; i++) {
		// 			const [, storeKeys] = storeHashKeyMapEntries[i];
		// 			// use only messages which have been processed(stored) by at least half the broker nodes
		// 			if (storeKeys.length < brokerNodes.length / 2) {
		// 				continue;
		// 			}
		//
		// 			// Add consolidated events to report
		// 			// ? Fees are determined after the report has been populated by the event data
		// 			const contributingPublishers = [];
		// 			for (let j = 0; j < storeKeys.length; j++) {
		// 				const [cacheKey, valueIndex] = storeKeys[j];
		// 				const cacheValues = storeCache.get(cacheKey);
		// 				const event = cacheValues[valueIndex].message;
		// 				if (!event) continue;
		//
		// 				// Now, we're iterating over each specific proofOfMessageStored event published by each Broker on the Broker Network
		//
		// 				contributingPublishers.push(event.metadata.publisherId);
		// 				// Stream ID is included in the system stream message.
		// 				const { streamId: id, size, hash } = event.content;
		// 				report.events.storage.push({
		// 					id,
		// 					hash,
		// 					size,
		// 				});
		//
		// 				if (typeof streamsMap[id] === 'undefined') {
		// 					streamsMap[id] = {
		// 						bytes: size,
		// 						contributors: [event.metadata.publisherId],
		// 					};
		// 				} else {
		// 					streamsMap[id].bytes += size;
		// 					if (
		// 						!streamsMap[id].contributors.includes(event.metadata.publisherId)
		// 					) {
		// 						streamsMap[id].contributors.push(event.metadata.publisherId);
		// 					}
		// 				}
		// 			}
		// 		}
		//
		// 		core.logger.debug('Storage Streams Map:', JSON.stringify(streamsMap));
		//
		// 		const streamsMapEntries = Object.entries(streamsMap);
		//
		// 		// Determine the Storage Fee per Byte
		// 		const totalBytesStored = streamsMapEntries.reduce((totalBytes, curr) => {
		// 			const [, { bytes }] = curr;
		// 			totalBytes += bytes;
		// 			return totalBytes;
		// 		}, 0);
		// 		let expense = new Decimal(0);
		// 		let expensePerByteStored = new Decimal(0);
		// 		if (totalBytesStored > 0) {
		// 			const usdValue = await Arweave.getPrice(totalBytesStored, toKeyMs);
		// 			const expenseBN = await stakeToken.fromUSD(usdValue, toKeyMs);
		// 			expense = new Decimal(expenseBN.toHexString());
		// 			expensePerByteStored = expense.div(totalBytesStored);
		// 		}
		// 		const writeFee = expensePerByteStored.mul(fees.writeMultiplier);
		// 		const writeTreasuryFee = writeFee
		// 			.sub(expensePerByteStored)
		// 			.mul(fees.treasuryMultiplier); // multiplier on the margin
		// 		const writeNodeFee = writeFee.sub(writeTreasuryFee);
		//
		// 		// Hydrate the report with storage data
		// 		for (let i = 0; i < streamsMapEntries.length; i++) {
		// 			const [streamId, { bytes, contributors }] = streamsMapEntries[i];
		//
		// 			const capture = writeFee.mul(bytes);
		// 			report.streams.push({
		// 				id: streamId,
		// 				capture,
		// 				bytes,
		// 			});
		// 			report.treasury = report.treasury.add(writeTreasuryFee.mul(bytes));
		//
		// 			// Deduct from Node based on the bytes missed.
		// 			// Use identification of publishers that validly contributed storage events to determine if current broker node was apart of that cohort.
		// 			rewardNodes(writeNodeFee.mul(bytes), contributors, true);
		// 		}

		// ------------ END STORAGE ------------
		// -------------------------------------

		// ------------ QUERIES ----------------
		// TODO: Report should
		//				On queries
		//				1. Determine the Primary Broker Node handling the request
		//				2. Check all `QueryResponse` messages that correlate to the `QueryRequest` to evaluate the `hashMap`**.**
		//				3. The `hashMap` will indicate what each Broker Node’s response is, and what data is missing from the Primary Node’s `hashMap`
		//				4. Check the `QueryPropagate` messages of the Primary Node to determine which Broker Nodes successfully propagated messages that were missing from the Primary Node.
		//				    1. *Reward and slash Broker Nodes accordingly.*
		//				5. Check `QueryPropagate` messages of the other Broker Nodes to determine if the majority of the Broker Nodes also received the same messages that the Primary Node did.
		//				    1. *Reward and slash Broker Nodes accordingly.*

		// FIXME: Old way
		//					### **Old Way:**
		//					\
		//					1. **Read Fees Determination:**
		//					    - Determining read fees based on the total bytes stored and applying multipliers for read fees.
		//					2. **Query Request Processing:**
		//					    - Iterating over the query requests within a specified timestamp range.
		//					    - Fetching corresponding query responses for each request.
		//					3. **Consensus Building:**
		//					    - Identifying a consensus response from the collected query responses based on a common hash.
		//					4. **Report Population:**
		//					    - Populating the report with query event details such as stream ID, query options, consumer ID, hash, and size.
		//					    - Capturing the total amount of stake based on read fees and size.
		//					    - Adjusting the report's treasury based on the read fees.
		//					    - Rewarding nodes that contributed to the consensus response.
		//					\
		//					### **Important Outcomes from Old Way:**
		//					\
		//					1. **Aggregated Query Data:**
		//					    - Stream IDs, query options, consumer IDs, and the size of data involved in each query.
		//					2. **Fee Calculations:**
		//					    - Total read fee, broken down into treasury and node fees.
		//					3. **Node Rewards:**
		//					    - Rewards or deductions for each node based on their contribution to the consensus response.
		//					4. **Consumer Charges:**
		//					    - Capture amounts representing the total amount of stake to capture token based on the read fees and size.

		// const queryRequestCache = listener.db.queryRequestDb();
		// const queryResponseCache = listener.db.queryResponseDb();
		// Iterate over the query-request events between the range
		// const queryRequestCachedItems = queryRequestCache.getRange({
		// 	start: fromKeyMs,
		// 	end: toKeyMs,
		// });

		// Determine read fees
		// const readFee = new Decimal(0);
		// FIXME commented out because it depends on above results
		// let readFee = new Decimal(0);
		// if (totalBytesStored > 0) {
		// 	readFee = writeFee.mul(fees.readMultiplier);
		// }
		// const readTreasuryFee = readFee.mul(fees.treasuryMultiplier);
		// const readNodeFee = readFee.sub(readTreasuryFee);

		// for (const { value: cacheValue } of queryRequestCachedItems) {
		// 	if (!cacheValue) continue;
		// 	for (let i = 0; i < cacheValue.length; i++) {
		// 		// Here, we iterate over the query requests that may have occured during the same timestamp
		// 		const value = cacheValue[i];

		// 		const { content, metadata } = value.message;
		// 		if (!(content && metadata)) {
		// 			continue;
		// 		}

		// 		const queryResponsesForRequest = queryResponseCache
		// 			.get(content.requestId)
		// 			.map((m) => m.message);

		// 		const {
		// 			// maxCount: consensusCount,
		// 			maxHash: consensusHash,
		// 			result: queryResponseHashMap,
		// 		} = fetchQueryResponseConsensus(queryResponsesForRequest);

		// 		// get data for response that has the highest consensus
		// 		//  -- In the future, we can penalise nodes for not meeting a threshold of >=50% of the responses

		// 		// get the first item because they should all be the same as they have the same hash
		// 		// and we have confirmed that the length is greater than one so an item will be present
		// 		const { hash, size } = queryResponseHashMap[consensusHash][0].content;

		// 		report.events.queries.push({
		// 			id: content.streamId,
		// 			query: content.queryOptions,
		// 			consumer: content.consumerId,
		// 			hash,
		// 			size,
		// 		});
		// 		const captureAmount = readFee.mul(size);
		// 		const existingConsumerIndex = report.consumers.findIndex(
		// 			(c) => c.id === content.consumerId
		// 		);
		// 		if (existingConsumerIndex < 0) {
		// 			report.consumers.push({
		// 				id: content.consumerId,
		// 				capture: captureAmount, // the total amount of stake to capture token in wei based on the calculations
		// 				bytes: size,
		// 			});
		// 		} else {
		// 			report.consumers[existingConsumerIndex].capture =
		// 				report.consumers[existingConsumerIndex].capture.add(captureAmount);
		// 			report.consumers[existingConsumerIndex].bytes += size;
		// 		}
		// 		report.treasury = report.treasury.add(readTreasuryFee.mul(size));

		// 		// Only apply fees to nodes that have contributed to the conensus response
		// 		const contributors = queryResponseHashMap[consensusHash].map(
		// 			(msg) => msg.metadata.publisherId
		// 		);
		// 		rewardNodes(readNodeFee.mul(size), contributors, false);
		// 	}
		// }
		// ------------ END QUERIES ------------
		// -------------------------------------

		const sortedReport = ReportUtils.sort(report);

		core.logger.debug('Report Generated', JSON.stringify(sortedReport));

		return ReportUtils.finalise(report);
	}
}
