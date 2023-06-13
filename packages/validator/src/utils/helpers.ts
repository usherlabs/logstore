import { StreamrMessage } from '@/types';
import { Provider } from '@ethersproject/providers';

/**
 * A function used to format a struct object gotten from the blockchain
 * @param struct {Array} a strut onject directly from the blockchain
 * @returns
 */
export const parseStruct = (struct: [] | Record<string, unknown>) => {
	const initialArgs = { ...struct };
	const parsedArgs = Object.create({});
	Object.keys(initialArgs).forEach((key) => {
		if (+key || +key === 0) return; // if the index is a number, it means it is a duplicate key we dont need
		parsedArgs[key] = initialArgs[key].toString();
	});
	return parsedArgs;
};

// Inspired by: https://medium.com/@hanyi.lol/how-to-get-a-block-number-by-timestamp-fefde4c69162
export async function getClosestBlockByTime(
	timestamp: number,
	provider: Provider,
	startBlockNumber: number
) {
	// A special case when KYVE runtime generates the very first bundle with the key starting form 0.
	if (timestamp === 0) {
		return await provider.getBlock(0);
	}

	// Maximum block variables
	let maxBlockNumber = await provider.getBlockNumber();
	let maxBlock = await provider.getBlock(maxBlockNumber);
	let maxBlockTs = maxBlock.timestamp;
	if (timestamp >= maxBlockTs) {
		return maxBlock;
	}

	// Minimum block variables
	let minBlockNumber = startBlockNumber;
	let minBlock = await provider.getBlock(minBlockNumber);
	let minBlockTs = minBlock.timestamp;

	// Current block variables
	let curBlockNumber;
	let curBlock;

	// Guessing function
	const guess = async () => {
		curBlockNumber =
			minBlockNumber +
			Math.floor(
				(maxBlockNumber - minBlockNumber) *
					((timestamp - minBlockTs) / (maxBlockTs - minBlockTs))
			);

		if (curBlockNumber < minBlockNumber) {
			curBlockNumber = minBlockNumber;
		}
		if (curBlockNumber > maxBlockNumber) {
			curBlockNumber = maxBlockNumber;
		}

		curBlock = await provider.getBlock(curBlockNumber);
	};

	// Main loop
	await guess();
	while (minBlockTs < timestamp && maxBlockTs > timestamp) {
		console.log(`checking blockNumber=${curBlockNumber}...`);
		const closestBlockTs = curBlock.timestamp;
		if (closestBlockTs === timestamp) {
			// foundExactBlock = true;
			break;
		} else if (closestBlockTs > timestamp) {
			maxBlockNumber = curBlockNumber - 1;
			maxBlock = await provider.getBlock(maxBlockNumber);
			maxBlockTs = maxBlock.timestamp;
		} else {
			minBlockNumber = curBlockNumber + 1;
			minBlock = await provider.getBlock(minBlockNumber);
			minBlockTs = minBlock.timestamp;
		}

		await guess();
	}

	return curBlock;
}

// go through all the responses recieved and verify using the content.hash property
// to find a consesnus of all the responses recieved the listener for a particular request
export function fetchQueryResponseConsensus(arr: StreamrMessage[]) {
	const result: Record<string, StreamrMessage[]> = {};
	let maxHash = null;
	let maxCount = -1;

	// Filter to ensure that each publisher only produces a single query response
	const filtered: StreamrMessage[] = [];
	arr.forEach((obj) => {
		if (
			!filtered
				.map((o) => o.metadata.publisherId)
				.includes(obj.metadata.publisherId)
		) {
			filtered.push(obj);
		}
	});

	// Produce a maxCount of a hash - and base the decision of consensus for a query response on this -- ie. the response that most nodes agreed to.
	filtered.forEach((obj) => {
		const hash = obj.content.hash;
		if (!result[hash]) {
			result[hash] = [obj];
		} else {
			result[hash].push(obj);
		}
		if (result[hash].length > maxCount) {
			maxCount = result[hash].length;
			maxHash = hash;
		}
	});
	return { result, maxHash, maxCount };
}
