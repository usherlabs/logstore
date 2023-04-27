import {
	getNodeManagerContract,
	prepareStakeForNodeManager,
} from '@concertodao/logstore-shared';
import { Command } from 'commander';
import { ethers } from 'ethers';
import { PrivateKeyAuthConfig } from 'streamr-client';

import { readConfigAndMigrateIfNeeded } from '../config/migration';
import {
	amountArgument,
	configOption,
	metadataOption,
	usdOption,
} from './options';
import { allowanceConfirm } from './utils';

export const joinCommand = new Command('join')
	.description('Join the LogStore Network as a Node Operator')
	.addArgument(amountArgument)
	.addOption(metadataOption)
	.addOption(configOption)
	.addOption(usdOption)
	.action(
		async (
			amountStr: string,
			cmdOptions: { usd?: boolean; metadata?: string }
		) => {
			try {
				const amount = cmdOptions.usd
					? parseFloat(amountStr)
					: BigInt(amountStr);
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
				console.log(
					`Joining network with stake amount ${stakeAmount} and metadata ${cmdOptions.metadata}...`
				);
				const receipt = await (
					await nodeManagerContract.join(stakeAmount, cmdOptions.metadata || '')
				).wait();
				console.log(
					`Successfully joined the network: Tx ${receipt.transactionHash}`
				);
			} catch (err) {
				console.error(err);
				process.exit(1);
			}
		}
	);
