import { PrivateKeyAuthConfig } from '@concertodao/logstore-client';
import {
	getNodeManagerContract,
	prepareStakeForNodeManager,
} from '@concertodao/logstore-shared';
import { Command } from 'commander';
import { ethers } from 'ethers';

import { readConfigAndMigrateIfNeeded } from '../config/migration';
import { amountArgument, configOption, usdOption } from './options';
import { allowanceConfirm } from './utils';

export const withdrawCommand = new Command('withdraw')
	.description('Withdraw your stake from the LogStore Network')
	.addArgument(amountArgument)
	.addOption(configOption)
	.addOption(usdOption)
	.action(async (amountStr: string, cmdOptions: { usd: boolean }) => {
		try {
			const amount = cmdOptions.usd ? parseFloat(amountStr) : BigInt(amountStr);
			const options = withdrawCommand.opts();
			const config = readConfigAndMigrateIfNeeded(options.config);

			const privateKey = (config.client!.auth as PrivateKeyAuthConfig)
				.privateKey;

			const provider = new ethers.providers.JsonRpcProvider(
				config.client!.contracts?.streamRegistryChainRPCs!.rpcs[0]
			);
			const signer = new ethers.Wallet(privateKey, provider);

			const stakeAmount = await prepareStakeForNodeManager(
				signer,
				amount,
				cmdOptions.usd,
				allowanceConfirm,
				false
			);
			const nodeManagerContract = await getNodeManagerContract(signer);
			await (await nodeManagerContract.withdraw(stakeAmount)).wait();
		} catch (err) {
			console.error(err);
			process.exit(1);
		}
	});
