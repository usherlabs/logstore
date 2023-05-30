/**
 * A script to support testing of final currency conversions from USD to Stake Token inside of Report Process
 */
import { JsonRpcProvider } from '@ethersproject/providers';

import { StakeToken } from '../src/utils/stake-token';

(async () => {
	const defaultProvider = new JsonRpcProvider('http://localhost:8546');

	const stakeToken = new StakeToken(
		'0xb47A27D9B3E86BdB4905D40f434B6C00fAfD862c',
		'LSAN',
		18,
		0,
		defaultProvider
	);
	await stakeToken.init();

	console.log(`$10 USD converted into ${stakeToken.fromUSD(10)}`);
})();
