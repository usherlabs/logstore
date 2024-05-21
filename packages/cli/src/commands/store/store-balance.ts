import { handleKnownError } from '@/utils/errors/handleErrors';
import { getClientsFromOptions } from '@/utils/logstore-client';
import { bytesToMessage, logger } from '@/utils/utils';
import { Command } from '@commander-js/extra-typings';
import chalk from 'chalk';
import Decimal from 'decimal.js';

const balanceCommand = new Command()
	.name('balance')
	.description('Check your balance staked for Storage')
	.action(async () => {
		try {
			const { streamrClient, logStoreClient } = getClientsFromOptions();

			await using cleanup = new AsyncDisposableStack();
			cleanup.defer(async () => {
				logStoreClient.destroy();
				await streamrClient.destroy();
			});

			const storeBalance = new Decimal(
				(await logStoreClient.getStoreBalance()).toString()
			);

			const availableStorage = storeBalance;
			console.log(
				`${storeBalance.toString()} LSAN staked on-chain for Storage.`
			);
			console.log(
				`${bytesToMessage(availableStorage)} of data is available for Storage.`
			);
		} catch (e) {
			logger.info(chalk.red('Storage Balance Check failed'));
			await handleKnownError(e);

			logger.error(e);
			process.exit(1);
		}
	});

export default balanceCommand;
