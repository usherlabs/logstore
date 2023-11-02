// define version command
import { appPackageName, appVersion } from '@/env-config';
import { Command } from '@commander-js/extra-typings';
import os from 'os';

export const versionCommand = new Command()
	.command('version')
	.description('Print runtime and protocol version')
	.action(() => {
		console.log(`${appPackageName} version: ${appVersion}`);
		console.log(`Node version: ${process.version}`);
		console.log();
		console.log(`Platform: ${os.platform()}`);
		console.log(`Arch: ${os.arch()}`);
	});
