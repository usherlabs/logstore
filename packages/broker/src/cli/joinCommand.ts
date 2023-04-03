import { Command } from 'commander';

import { readConfigAndMigrateIfNeeded } from '../config/migration';
import { configOption } from './options';

export const joinCommand = new Command('join')
	.description('join the LogStore network')
	.addOption(configOption)
	.action(async (args) => {
		try {
			// TODO: Implement the Join command
			console.log('Joining...');

			const config = readConfigAndMigrateIfNeeded(args.config);
			console.log(config);
		} catch (err) {
			console.error(err);
			process.exit(1);
		}
	});
