/**
 * A script to support testing of final currency conversions from USD to Stake Token inside of Report Process
 */
import redstone from 'redstone-api';

import { convertToStakeToken } from '../src/utils/helpers';

(async () => {
	const stakeToken = {
		symbol: 'DATA',
		decimals: 18,
	};
	let priceOfStakeToken = 0.01;
	try {
		const rsResp = await redstone.getPrice(stakeToken.symbol, {
			verifySignature: true,
		});
		console.log('Fetched Price from Redstone', rsResp);
		priceOfStakeToken = rsResp.value;
	} catch (e) {
		console.log(`Could not fetch the Price of ${stakeToken.symbol}`);
	}
	const toStakeToken = convertToStakeToken(
		priceOfStakeToken,
		stakeToken.decimals
	);

	console.log(`$10 USD converted into ${toStakeToken(10)}`);
})();
