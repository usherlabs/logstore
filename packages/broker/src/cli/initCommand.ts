import { Command } from 'commander';

export const initCommand = new Command('init')
	.description('init the configuration for the broker node')
	.action(async () => {
		try {
			// TODO: Implement the Init command
			console.log('Init...');
		} catch (err) {
			console.error(err);
			process.exit(1);
		}
	});
