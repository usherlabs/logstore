import { Alchemy, FeeData, Network } from 'alchemy-sdk';
import { task } from 'hardhat/config';

import { getTaskConfig } from './utils';

task('admin:mint-many', 'Admin: Mint many tokens to Addresses')
	.addPositionalParam(
		'recipients',
		'Comma-separated list of EVM Wallet Addresses'
	)
	.addPositionalParam('amount')
	.setAction(async (taskArgs: { recipients: string; amount: number }, hre) => {
		const { tokenContract, chainId } = await getTaskConfig(hre);

		let feeData: FeeData | null = null;
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
		}

		const { recipients, amount } = taskArgs;

		const recipientAddresses = recipients.split(',');

		const tx = await tokenContract.mintManyTokens(
			recipientAddresses,
			amount,
			feeData
				? {
						gasPrice: feeData.gasPrice?.toBigInt(),
				  }
				: undefined
		);
		console.log(`Submitted minting ${amount} LSAN tokens to the recipients:`);
		recipientAddresses.forEach((r) => console.log(r));
		const receipt = await tx.wait();
		console.log(`Tx: ${receipt.transactionHash}`);
	});
