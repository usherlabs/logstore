import { LSAN__factory } from '@logsn/contracts';
import { ethers, Signer } from 'ethers';
import { Logger } from 'tslog';

import { getTokenPrice } from './getTokenPrice';

const logger = new Logger();

export const convertFromUsd = async (
	stakeTokenAddress: string,
	amount: number,
	signer: Signer,
	timestamp: number
) => {
	const stakeTokenContract = LSAN__factory.connect(stakeTokenAddress, signer);
	const stakeTokenSymbol = await stakeTokenContract.symbol();
	const stakeTokenDecimals = await stakeTokenContract.decimals();

	logger.info('Converting USD amount to token amount...');
	logger.debug('Stake Token Decimals: ', stakeTokenDecimals.toString());

	let price = 0.01;
	try {
		price = await getTokenPrice(stakeTokenAddress, timestamp, signer);
	} catch (e) {
		logger.warn(`Cannot get price of ${stakeTokenSymbol} from RedStone`);
	}
	const amountInUSD = amount / price;
	amount = Math.floor(
		parseInt(
			ethers.utils.parseUnits(`${amountInUSD}`, stakeTokenDecimals).toString(),
			10
		)
	);

	return amount;
};
