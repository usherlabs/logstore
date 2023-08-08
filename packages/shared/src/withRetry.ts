import { ethers } from 'ethers';
import { Logger } from 'tslog';

export const logger = new Logger();

export const withRetry = async (
	provider: ethers.providers.JsonRpcProvider,
	fn: (estimate?: ethers.BigNumber) => Promise<ethers.ContractTransaction>
) => {
	let tx: ethers.ContractTransaction | undefined = undefined;
	let estimate = await provider.getGasPrice();
	let retryCount = 0;
	while (!tx) {
		try {
			tx = await fn(estimate);
			break;
		} catch (e) {
			logger.warn(
				'Failed to submit transaction. Retrying with a new gas estimate...'
			);
			if (
				e.message.match(
					/replacement transaction underpriced|transaction gas price.*too low/i
				)
			) {
				estimate = await provider.getGasPrice();
				retryCount++;
				estimate.add(100000 * retryCount);
			} else {
				throw e;
			}
		}
	}

	return tx;
};
