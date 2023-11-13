import { getLogStoreClientFromOptions } from '@/utils/logstore-client';
import { bytesToMessage, logger } from '@/utils/utils';
import { Command } from '@commander-js/extra-typings';
import chalk from 'chalk';
import Decimal from 'decimal.js';

const balanceCommand = new Command()
	.name('balance')
	.description('Check your balance staked for Storage')
	.action(async () => {
		try {
			const client = getLogStoreClientFromOptions();

			const storeBalance = new Decimal(
				(await client.getStoreBalance()).toString()
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
			logger.error(e);
		}
	});

export default balanceCommand;
