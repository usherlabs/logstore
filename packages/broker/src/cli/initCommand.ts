import { Command } from 'commander';

import { startConfigWizard } from '../config/ConfigWizard';

export const initCommand = new Command('init')
	.description('init the configuration for the broker node')
	.action(async () => {
		try {
			startConfigWizard();
		} catch (err) {
			console.error(err);
			process.exit(1);
		}
	});
