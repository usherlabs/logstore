import { balanceCommand } from '@/commands/balance';
import { createStreamCommand } from '@/commands/create-stream';
import { initCommand } from '@/commands/init';
import { mintCommand } from '@/commands/mint';
import { getRootOptions, setRootOptions } from '@/commands/options';
import { queryCommand } from '@/commands/query';
import { storeCommand } from '@/commands/store';
import { versionCommand } from '@/commands/version';
import { defaultConfigPath, IConfig, resolveHome } from '@/configuration';
import { appVersion } from '@/env-config';
import { logger } from '@/utils/utils';
import { Command } from '@commander-js/extra-typings';
import jsonfile from 'jsonfile';

export const rootProgram = new Command()
	.name('logstore-cli')
	.description(
		'Store event/atomic data and then query by timestamp on the Log Store Network.'
	)
	.version(appVersion)
	.option('-h, --host <string>', 'Polygon/EVM Node RPC Endpoint')
	.option('-w, --wallet <string>', 'Wallet private key')
	.option(
		'-c, --config <string>',
		'Path to configuration file. Defaults to ~/.logstore-cli/default.json',
		defaultConfigPath
	)
	.option('-d, --debug', 'Show debug logs')
	.hook('preAction', async (thisCommand, calledCommand) => {
		// this shouldn't execute if the action is version
		if (calledCommand.name() === 'version') {
			return;
		}
		const { config } = getRootOptions();
		console.log({ config });
		const configFilePath = resolveHome(config);

		const configData: IConfig = await jsonfile
			.readFile(configFilePath)
			.catch(() => ({ privateKey: '', host: '' }));


		setRootOptions((args) => {
			const newArgs = { ...args };

			if (!args.wallet && configData.privateKey) {
				newArgs.wallet = configData.privateKey;
			}
			if (!args.host && configData.host) {
				newArgs.host = configData.host;
			}

			if (!newArgs.host) {
				throw new Error('Host RPC Endpoint cannot be empty');
			}

			if (!newArgs.wallet) {
				throw new Error('Wallet Private Key is invalid');
			}

			return newArgs;
		});

		// eslint-disable-next-line immutable/no-mutation
		logger.settings.minLevel = thisCommand.opts().debug ? 0 : 3;
	});

rootProgram.addCommand(versionCommand);
rootProgram.addCommand(initCommand);
rootProgram.addCommand(mintCommand);
rootProgram.addCommand(balanceCommand);
rootProgram.addCommand(queryCommand);
rootProgram.addCommand(createStreamCommand);
rootProgram.addCommand(storeCommand);
