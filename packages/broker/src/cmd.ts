import { Command } from 'commander';
import os from 'os';

import { version } from '../package.json';

export class Cmd {
	public program: Command;

	constructor() {
		this.program = new Command();
	}

	public boostrap() {
		const { program } = this;

		program
			.version(version)
			.command('version')
			.description('Print Log Store Broker Node Version')
			.action(() => {
				console.log(`Log Store Broker Node version: ${version}`);
				console.log(`Node version: ${process.version}`);
				console.log();
				console.log(`Platform: ${os.platform()}`);
				console.log(`Arch: ${os.arch()}`);
			});

		program
			.command('start')
			.requiredOption(
				'--config <string>',
				'Path to Streamr Config File. Use `npx streamr-broker-init` to create your config file.'
			)
			.action(() => {
				// TODO: Setup a Streamr Broker Node with Config -- and force the use of Storage Plugin
				// TODO: Streamr Broker Node must be extended to override how queries are handled.
			});
	}
}
