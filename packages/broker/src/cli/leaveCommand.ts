import { validateConfig as validateLogStoreClientConfig } from '@logsn/client';
import { getNodeManagerContract, withRetry } from '@logsn/shared';
import { Command } from 'commander';
import { ethers } from 'ethers';
import { PrivateKeyAuthConfig } from 'streamr-client';

import { overrideConfigToEnvVarsIfGiven } from '../config/config';
import BROKER_CONFIG_SCHEMA from '../config/config.schema.json';
import { readConfigAndMigrateIfNeeded } from '../config/migration';
import { validateConfig } from '../config/validateConfig';
import { configOption } from './options';

export const leaveCommand = new Command('leave')
	.description('Unstake and Leave the LogStore Network')
	.addOption(configOption)
	.action(async () => {
		try {
			const options = leaveCommand.opts();
			const configWithoutDefaults = readConfigAndMigrateIfNeeded(
				options.config
			);
			overrideConfigToEnvVarsIfGiven(configWithoutDefaults);
			const config = validateConfig(
				configWithoutDefaults,
				BROKER_CONFIG_SCHEMA
			);
			validateLogStoreClientConfig(config.logStoreClient);

			const privateKey = (config.streamrClient!.auth as PrivateKeyAuthConfig)
				.privateKey;

			const provider = new ethers.providers.JsonRpcProvider(
				config.streamrClient!.contracts?.streamRegistryChainRPCs!.rpcs[0]
			);
			const signer = new ethers.Wallet(privateKey, provider);

			const nodeManagerContract = await getNodeManagerContract(signer);
			console.log(`Leaving the network...`);

			const tx = await withRetry(provider, (gasPrice) => {
				return nodeManagerContract.leave({ gasPrice });
			});

			const receipt = await tx.wait();
			console.log(
				`Successfully left the network: Tx ${receipt.transactionHash}`
			);
		} catch (err) {
			console.error(err);
			process.exit(1);
		}
	});
