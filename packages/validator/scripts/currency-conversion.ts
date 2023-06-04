/**
 * A script to support testing of final currency conversions from USD to Stake Token inside of Report Process
 */
import { JsonRpcProvider } from '@ethersproject/providers';
import { fastPrivateKey } from '@streamr/test-utils';
import { ethers } from 'ethers';

import { StakeToken } from '../src/utils/stake-token';

(async () => {
	const jsonProvider = new JsonRpcProvider('http://localhost:8546');
	const wallet = new ethers.Wallet(fastPrivateKey(), jsonProvider);
	const signer = wallet.connect(jsonProvider);

	const stakeToken = new StakeToken(
		'0xdb41c030baf8C73FbDb8d1b5FC24953461fa5EAf',
		'LSAN',
		18,
		0,
		signer
	);

	await stakeToken.init();

	console.log(`$10 USD converted into ${stakeToken.fromUSD(10)}`);
})();
