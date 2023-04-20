import { Command } from 'commander';

import { createBroker } from '../broker';
import { overrideConfigToEnvVarsIfGiven } from '../config/config';
import { readConfigAndMigrateIfNeeded } from '../config/migration';
import { configOption } from './options';

export const startCommand = new Command('start')
	.description('Start the broker node')
	.addOption(configOption)
	.action(async (args) => {
		try {
			const config = readConfigAndMigrateIfNeeded(args.config);
			overrideConfigToEnvVarsIfGiven(config);
			const broker = await createBroker(config);
			await broker.start();
		} catch (err) {
			console.error(err);
			process.exit(1);
		}
	});
