/**
 * A script to support testing of final currency conversions from USD to Stake Token inside of Report Process
 */
import { StakeToken } from '../src/utils/stake-token';

(async () => {
	const stakeToken = new StakeToken('', 'DATA', 18, 0);
	await stakeToken.init();

	console.log(`$10 USD converted into ${stakeToken.fromUSD(10)}`);
})();
