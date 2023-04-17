import { ERC20__factory } from '@concertodao/logstore-contracts';
import { ethers, Signer } from 'ethers';
import redstone from 'redstone-api';
import { Logger } from 'tslog';

const logger = new Logger();

export const convertFromUsd = async (
	stakeTokenAddress: string,
	amount: number,
	signer: Signer
) => {
	const stakeTokenContract = ERC20__factory.connect(stakeTokenAddress, signer);
	const stakeTokenSymbol = await stakeTokenContract.symbol();
	const stakeTokenDecimals = await stakeTokenContract.decimals();

	logger.info('Converting USD amount to token amount...');
	logger.debug('Stake Token Decimals: ', stakeTokenDecimals.toString());

	let price = 0.01;
	try {
		const rsResp = await redstone.getPrice(stakeTokenSymbol);
		price = rsResp.value;
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
