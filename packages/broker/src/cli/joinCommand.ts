import {
	PrivateKeyAuthConfig,
	validateConfig as validateClientConfig,
} from '@logsn/client';
import {
	getNodeManagerContract,
	prepareStakeForNodeManager,
	withRetry,
} from '@logsn/shared';
import { Command } from 'commander';
import { ethers } from 'ethers';

import { overrideConfigToEnvVarsIfGiven } from '../config/config';
import BROKER_CONFIG_SCHEMA from '../config/config.schema.json';
import { readConfigAndMigrateIfNeeded } from '../config/migration';
import { validateConfig } from '../config/validateConfig';
import {
	amountArgument,
	assumeYesOption,
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
	.addOption(assumeYesOption)
	.action(
		async (
			amountStr: string,
			cmdOptions: { usd?: boolean; metadata?: string; assumeYes: boolean }
		) => {
			try {
				const amount = cmdOptions.usd
					? parseFloat(amountStr)
					: BigInt(amountStr);
				const options = joinCommand.opts();
				const configWithoutDefaults = readConfigAndMigrateIfNeeded(
					options.config
				);
				overrideConfigToEnvVarsIfGiven(configWithoutDefaults);
				const config = validateConfig(
					configWithoutDefaults,
					BROKER_CONFIG_SCHEMA
				);
				validateClientConfig(config.client);

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
					!cmdOptions.assumeYes ? allowanceConfirm : undefined
				);
				const nodeManagerContract = await getNodeManagerContract(signer);
				console.log(
					`Joining the network with stake amount ${stakeAmount} and metadata ${cmdOptions.metadata}...`
				);

				const tx = await withRetry(provider, (gasPrice) => {
					return nodeManagerContract.join(
						stakeAmount,
						cmdOptions.metadata || '',
						{ gasPrice }
					);
				});

				const receipt = await tx.wait();
				console.log(
					`Successfully joined the network: Tx ${receipt.transactionHash}`
				);
			} catch (err) {
				console.error(err);
				process.exit(1);
			}
		}
	);
