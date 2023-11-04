import { getRootOptions } from '@/commands/options';
import { getLogStoreClientFromOptions } from '@/utils/logstore-client';
import { logger } from '@/utils/utils';
import { Command } from '@commander-js/extra-typings';
import chalk from 'chalk';
import Decimal from 'decimal.js';

export const mintCommand = new Command()
	.command('mint')
	.description('Mint LSAN tokens for the Log Store Network')
	.argument(
		'<amount>',
		'Amount of MATIC (default) or USD (in MATIC) or Bytes (in MATIC) to exchange for LSAN.'
	)
	.option(
		'-u, --usd',
		'Pass in an amount in USD which will automatically convert to the appropriate amount of token to mint.'
	)
	.option(
		'-b, --bytes',
		'Pass in an amount of bytes that you would like to store. This will automatically convert to the appropriate amount of token to mint.'
	)
	.action(async (amount: string, cmdOptions) => {
		const rootOptions = getRootOptions();

		if (cmdOptions.usd && cmdOptions.bytes) {
			throw new Error('Cannot pass USD and BYTES flags together.');
		}
		logger.debug('Command Params: ', { amount, ...rootOptions, ...cmdOptions });

		try {
			const client = getLogStoreClientFromOptions();

			const mintType = cmdOptions.usd
				? 'usd'
				: cmdOptions.bytes
				? 'bytes'
				: 'wei';

			const amountInToken = await client.convert({
				amount,
				from: mintType,
				to: 'wei',
			});

			const result = await client.mint(
				BigInt(new Decimal(amountInToken).toHex())
			);

			console.log(
				`Successfully minted tokens to network:Tx ${result.hash}, Amount:Tx ${amountInToken}. Waiting for confirmations...`
			);

			await result.wait();
			console.log('Mint confirmed.');
		} catch (e) {
			logger.info(chalk.red('mint failed'));
			logger.error(e);
		}
	});
