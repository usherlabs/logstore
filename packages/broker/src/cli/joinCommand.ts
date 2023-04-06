import {
	getNodeManagerContract,
	prepareStakeForNodeManager,
} from '@concertodao/logstore-shared';
import { Command } from 'commander';
import { ethers } from 'ethers';
import { PrivateKeyAuthConfig } from 'streamr-client';

import { readConfigAndMigrateIfNeeded } from '../config/migration';
import { amountArgument, configOption, usdOption } from './options';
import { allowanceConfirm } from './utils';

export const joinCommand = new Command('join')
	.description('join the LogStore network')
	.addArgument(amountArgument)
	.addOption(configOption)
	.addOption(usdOption)
	.action(async (amountStr: string, cmdOptions: { usd: boolean }) => {
		try {
			const amount = parseFloat(amountStr);
			const options = joinCommand.opts();
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
				allowanceConfirm
			);
			const nodeManagerContract = await getNodeManagerContract(signer);
			await (
				await nodeManagerContract.join(stakeAmount, 'my node metadata')
			).wait();
		} catch (err) {
			console.error(err);
			process.exit(1);
		}
	});
