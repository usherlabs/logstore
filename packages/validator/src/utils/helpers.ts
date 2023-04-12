import { ethers } from 'ethers';

// Inspired by: https://medium.com/@hanyi.lol/how-to-get-a-block-number-by-timestamp-fefde4c69162
export async function getClosestBlockByTime(
	timestamp: number,
	provider: ethers.Provider
) {
	let maxBlockNumber = await provider.getBlockNumber();
	let minBlockNumber = 0;
	const maxBlock = await provider.getBlock(maxBlockNumber);
	if (timestamp >= maxBlock.timestamp) {
		return maxBlock;
	} else {
		minBlockNumber = Math.floor(
			maxBlockNumber -
				((maxBlock.timestamp - timestamp) / maxBlock.timestamp) * maxBlockNumber
		);
	}

	let closestBlockNumber = Math.floor((maxBlockNumber + minBlockNumber) / 2);
	let closestBlock = await provider.getBlock(closestBlockNumber);
	// let foundExactBlock = false;

	while (minBlockNumber <= maxBlockNumber) {
		console.log(`checking blockNumber=${closestBlockNumber}...`);
		if (closestBlock.timestamp === timestamp) {
			// foundExactBlock = true;
			break;
		} else if (closestBlock.timestamp > timestamp) {
			maxBlockNumber = closestBlockNumber - 1;
		} else {
			minBlockNumber = closestBlockNumber + 1;
		}

		closestBlockNumber = Math.floor((maxBlockNumber + minBlockNumber) / 2);
		closestBlock = await provider.getBlock(closestBlockNumber);
	}

	return closestBlock;
}
