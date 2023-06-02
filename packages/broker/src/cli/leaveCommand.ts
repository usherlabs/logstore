import { PrivateKeyAuthConfig } from '@logsn/client';
import { getNodeManagerContract } from '@logsn/shared';
import { Command } from 'commander';
import { ethers } from 'ethers';

import { readConfigAndMigrateIfNeeded } from '../config/migration';
import { configOption } from './options';

export const leaveCommand = new Command('leave')
	.description('Unstake and Leave the LogStore Network')
	.addOption(configOption)
	.action(async () => {
		try {
			const options = leaveCommand.opts();
			const config = readConfigAndMigrateIfNeeded(options.config);

			const privateKey = (config.client!.auth as PrivateKeyAuthConfig)
				.privateKey;

			const provider = new ethers.providers.JsonRpcProvider(
				config.client!.contracts?.streamRegistryChainRPCs!.rpcs[0]
			);
			const signer = new ethers.Wallet(privateKey, provider);

			const nodeManagerContract = await getNodeManagerContract(signer);
			await (await nodeManagerContract.leave()).wait();
		} catch (err) {
			console.error(err);
			process.exit(1);
		}
	});
