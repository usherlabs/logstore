import { getRootOptions } from '@/commands/options';
import { logger, printPrices } from '@/utils/utils';
import { Command } from '@commander-js/extra-typings';
import chalk from 'chalk';

export const priceCommand = new Command()
	.command('price')
	.option(
		'-b, --base <base>',
		'Base unit to use for prices. Options: byte, query, wei, usd',
		'byte'
	)
	.description('Check important prices on the Log Store Network')
	.action(async (cmdOptions) => {
		const rootOptions = getRootOptions();

		logger.debug('Command Params: ', { ...rootOptions, ...cmdOptions });

		try {
			await printPrices(cmdOptions.base as any);
		} catch (e: unknown) {
			console.info(chalk.red('Checking prices failed.'));

			console.error(e);
			process.exit(1);
		}
	});
