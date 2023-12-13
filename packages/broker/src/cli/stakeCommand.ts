import { PrivateKeyAuthConfig } from '@logsn/client';
import {
	getNodeManagerContract,
	prepareStakeForNodeManager,
} from '@logsn/shared';
import { Command } from 'commander';
import { ethers } from 'ethers';

import { readConfigAndMigrateIfNeeded } from '../config/migration';
import { amountArgument, configOption, usdOption } from './options';
import { allowanceConfirm } from './utils';

export const stakeCommand = new Command('stake')
	.description(
		'Stake in the LogStore Network before delegating your stake to a specific Node'
	)
	.addArgument(amountArgument)
	.addOption(configOption)
	.addOption(usdOption)
	.action(async (amountStr: string, cmdOptions: { usd: boolean }) => {
		try {
			const amount = cmdOptions.usd ? parseFloat(amountStr) : BigInt(amountStr);
			const options = stakeCommand.opts();
			const config = readConfigAndMigrateIfNeeded(options.config);

			const privateKey = (config.streamrClient!.auth as PrivateKeyAuthConfig)
				.privateKey;

			const provider = new ethers.providers.JsonRpcProvider(
				config.streamrClient!.contracts?.streamRegistryChainRPCs!.rpcs[0]
			);
			const signer = new ethers.Wallet(privateKey, provider);

			const stakeAmount = await prepareStakeForNodeManager(
				signer,
				amount,
				cmdOptions.usd,
				allowanceConfirm
			);
			const nodeManagerContract = await getNodeManagerContract(signer);
			await (await nodeManagerContract.stake(stakeAmount)).wait();
		} catch (err) {
			console.error(err);
			process.exit(1);
		}
	});
