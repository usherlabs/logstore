import { readFeeMultiplier } from '@/configuration';
import { handleKnownError } from '@/utils/errors/handleErrors';
import { getClientsFromOptions } from '@/utils/logstore-client';
import { bytesToMessage, logger } from '@/utils/utils';
import { Command } from '@commander-js/extra-typings';
import chalk from 'chalk';
import Decimal from 'decimal.js';

const queryBalanceCommand = new Command()
	.name('balance')
	.description('Check your balance staked for Query requests')
	.action(async () => {
		try {
			const { streamrClient, logStoreClient } = getClientsFromOptions();

			await using cleanup = new AsyncDisposableStack();
			cleanup.defer(async () => {
				logStoreClient.destroy();
				await streamrClient.destroy();
			});

			const queryBalance = new Decimal(
				(await logStoreClient.getQueryBalance()).toString()
			);

			const availableStorage = queryBalance.div(readFeeMultiplier);
			console.log(
				`${queryBalance.toString()} LSAN staked on-chain for Queries.`
			);
			console.log(
				`${bytesToMessage(availableStorage)} of data is available for Queries.`
			);
		} catch (e) {
			logger.error(chalk.red('Query Balance Check failed'));
			await handleKnownError(e);

			logger.error(e);
			process.exit(1);
		}
	});

export default queryBalanceCommand;
