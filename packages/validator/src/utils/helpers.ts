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
	provider: Provider
) {
	let maxBlockNumber = await provider.getBlockNumber();
	let minBlockNumber = 0;
	const maxBlock = await provider.getBlock(maxBlockNumber);
	const maxBlockTs = maxBlock.timestamp * 1000;
	if (timestamp >= maxBlockTs) {
		return maxBlock;
	} else {
		minBlockNumber = Math.floor(
			maxBlockNumber - ((maxBlockTs - timestamp) / maxBlockTs) * maxBlockNumber
		);
	}

	let closestBlockNumber = Math.floor((maxBlockNumber + minBlockNumber) / 2);
	let closestBlock = await provider.getBlock(closestBlockNumber);
	// let foundExactBlock = false;

	while (minBlockNumber <= maxBlockNumber) {
		console.log(`checking blockNumber=${closestBlockNumber}...`);
		const closestBlockTs = closestBlock.timestamp * 1000;
		if (closestBlockTs === timestamp) {
			// foundExactBlock = true;
			break;
		} else if (closestBlockTs > timestamp) {
			maxBlockNumber = closestBlockNumber - 1;
		} else {
			minBlockNumber = closestBlockNumber + 1;
		}

		closestBlockNumber = Math.floor((maxBlockNumber + minBlockNumber) / 2);
		closestBlock = await provider.getBlock(closestBlockNumber);
	}

	return closestBlock;
}
