import { PrivateKeyAuthConfig } from '@concertotech/logstore-client';
import {
	convertFromUsd,
	getTokenManagercontract,
} from '@concertotech/logstore-shared';
import { Command } from 'commander';
import { ethers } from 'ethers';

import { readConfigAndMigrateIfNeeded } from '../config/migration';
import { amountArgument, configOption, usdOption } from './options';

export const mintAlphaNetToken = new Command('mint-lsan')
	.description('Deposit some Matic to the contract in order to get some LSAN')
	.addArgument(amountArgument)
	.addOption(configOption)
	.addOption(usdOption)
	.action(async (amountStr: string, cmdOptions: { usd?: boolean }) => {
		try {
			const options = mintAlphaNetToken.opts();
			const config = readConfigAndMigrateIfNeeded(options.config);
			const privateKey = (config.client!.auth as PrivateKeyAuthConfig)
				.privateKey;
			const provider = new ethers.providers.JsonRpcProvider(
				config.client!.contracts?.streamRegistryChainRPCs!.rpcs[0]
			);
			const signer = new ethers.Wallet(privateKey, provider);

			const tokenManagerContract = await getTokenManagercontract(signer);

			let amount = cmdOptions.usd ? parseFloat(amountStr) : BigInt(amountStr);
			if (cmdOptions.usd) {
				amount = await convertFromUsd(
					tokenManagerContract.address,
					Number(amount),
					signer
				);
			}

			const receipt = await (
				await tokenManagerContract.mint({ value: amount })
			).wait();

			console.log(
				`Successfully joined the network: Tx ${receipt.transactionHash}`
			);
		} catch (err) {
			console.error(err);
			process.exit(1);
		}
	});
