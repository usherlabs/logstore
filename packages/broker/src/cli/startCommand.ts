import { Command } from 'commander';

import { createBroker } from '../broker';
import { overrideConfigToEnvVarsIfGiven } from '../config/config';
import { readConfigAndMigrateIfNeeded } from '../config/migration';
import { configOption } from './options';

export const startCommand = new Command('start')
	.description('start the broker node')
	.addOption(configOption)
	.action(async (_, options) => {
		try {
			const config = readConfigAndMigrateIfNeeded(options.configFile);
			overrideConfigToEnvVarsIfGiven(config);
			const broker = await createBroker(config);
			await broker.start();
		} catch (err) {
			console.error(err);
			process.exit(1);
		}
	});
