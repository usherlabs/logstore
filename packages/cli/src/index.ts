import { Command } from 'commander';
import os from 'os';

import { appPackageName, appVersion } from './env-config';

// define main program
const program = new Command();

// define version command
program
	.command('version')
	.description('Print runtime and protocol version')
	.action(() => {
		console.log(`${appPackageName} version: ${appVersion}`);
		console.log(`Node version: ${process.version}`);
		console.log();
		console.log(`Platform: ${os.platform()}`);
		console.log(`Arch: ${os.arch()}`);
	});

program.parse();
