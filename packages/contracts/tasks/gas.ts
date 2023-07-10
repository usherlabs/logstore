import { Alchemy, BigNumber, FeeData, Network } from 'alchemy-sdk';
import { task } from 'hardhat/config';

import { getTaskConfig } from './utils';

task('admin:gas', 'Admin: Fetch gas estimate from Alchemy').setAction(
	async (taskArgs, hre) => {
		const { chainId } = await getTaskConfig(hre);

		let feeData: FeeData | null = null;
		let gasPrice: BigNumber | null = null;
		if (
			chainId === 137 &&
			process.env.POLYGON_MAINNET &&
			process.env.POLYGON_MAINNET.includes('alchemy.com')
		) {
			const sp = process.env.POLYGON_MAINNET.split('/');
			const apiKey = sp[sp.length - 1];
			// Configures the Alchemy SDK
			const config = {
				apiKey, // Replace with your API key
				network: Network.MATIC_MAINNET, // Replace with your network
			};

			// Creates an Alchemy object instance with the config to use for making requests
			const alchemy = new Alchemy(config);
			feeData = await alchemy.core.getFeeData();
			gasPrice = await alchemy.core.getGasPrice();
		}

		console.log({ feeData, gasPrice });
	}
);
