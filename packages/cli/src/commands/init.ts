import { getRootOptions } from '@/commands/options';
import { defaultConfigPath, resolveHome } from '@/configuration';
import { Command } from '@commander-js/extra-typings';
import jsonfile from 'jsonfile';
import { mkdirp } from 'mkdirp';

export const initCommand = new Command()
	.command('init')
	.description('Creates a configuration file with default parameters')
	.option(
		'-o, --output <string>',
		'The destination file to write the config to.',
		defaultConfigPath
	)
	.action(async (cmdOptions: { output: string }) => {
		const rootOptions = getRootOptions();

		const configFilePath = resolveHome(cmdOptions.output);
		const dirPath = configFilePath.substring(
			0,
			configFilePath.lastIndexOf('/')
		);
		await mkdirp(dirPath);
		await jsonfile.writeFile(configFilePath, {
			privateKey: rootOptions.wallet,
			host: rootOptions.host,
		});
		console.log(`Configuration file saved to ${configFilePath}`);
	});
