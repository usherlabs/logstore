import {
	getNodeManagerContract,
	prepareStakeForNodeManager,
} from '@concertodao/logstore-shared';
import { PrivateKeyAuthConfig } from '@concertodao/streamr-client';
import { Command } from 'commander';
import { ethers } from 'ethers';

import { readConfigAndMigrateIfNeeded } from '../config/migration';
import {
	amountArgument,
	configOption,
	delegateAddressArgument,
	usdOption,
} from './options';
import { allowanceConfirm } from './utils';

export const delegateCommand = new Command('delegate')
	.description('Delegate your stake to a Node on the LogStore Network')
	.addArgument(amountArgument)
	.addArgument(delegateAddressArgument)
	.addOption(configOption)
	.addOption(usdOption)
	.action(
		async (
			amountStr: string,
			delegateAddress: string,
			cmdOptions: { usd: boolean }
		) => {
			try {
				const amount = cmdOptions.usd
					? parseFloat(amountStr)
					: BigInt(amountStr);
				const options = delegateCommand.opts();
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
					await nodeManagerContract.delegate(stakeAmount, delegateAddress)
				).wait();
			} catch (err) {
				console.error(err);
				process.exit(1);
			}
		}
	);
