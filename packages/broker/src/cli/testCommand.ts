import { Command } from 'commander';

import { createBroker } from '../broker';
import { overrideConfigToEnvVarsIfGiven } from '../config/config';
import { readConfigAndMigrateIfNeeded } from '../config/migration';
import { configOption } from './options';

export const testCommand = new Command('test')
	.description('Test the configuration (does not start the broker node)')
	.addOption(configOption)
	.action(async (args) => {
		try {
			const config = readConfigAndMigrateIfNeeded(args.config);
			overrideConfigToEnvVarsIfGiven(config);
			await createBroker(config);
			console.info('the configuration is valid');
			// TODO: remove process.exit(0)
			// We should not need explicit exit call if all setTimeouts are cleared.
			// Currently there is only one leaking timeout in PingPongWs (created
			// by NodeClientWsEndpoint from the createNetworkNode() call)
			process.exit(0);
		} catch (err) {
			console.error(err);
			process.exit(1);
		}
	});
