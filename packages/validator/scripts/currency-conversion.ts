/**
 * A script to support testing of final currency conversions from USD to Stake Token inside of Report Process
 */
import { ethers } from 'ethers';
import redstone from 'redstone-api';

(async () => {
	const stakeToken = {
		symbol: 'DATA',
		decimals: 18,
	};
	let priceOfStakeToken = 0.01;
	try {
		const rsResp = await redstone.getPrice(stakeToken.symbol);
		console.log('Fetched Price from Redstone', rsResp);
		priceOfStakeToken = rsResp.value;
	} catch (e) {
		console.log(`Could not fetch the Price of ${stakeToken.symbol}`);
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

	console.log(`$10 USD converted into ${toStakeToken(10)}`);
})();
