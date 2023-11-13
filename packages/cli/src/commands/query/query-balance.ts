import { readFeeMultiplier } from '@/configuration';
import { getLogStoreClientFromOptions } from '@/utils/logstore-client';
import { bytesToMessage, logger } from '@/utils/utils';
import { Command } from '@commander-js/extra-typings';
import chalk from 'chalk';
import Decimal from 'decimal.js';

const queryBalanceCommand = new Command()
	.name('balance')
	.description('Check your balance staked for Query requests')
	.action(async () => {
		try {
			const client = getLogStoreClientFromOptions();

			const queryBalance = new Decimal(
				(await client.getQueryBalance()).toString()
			);

			const availableStorage = queryBalance.div(readFeeMultiplier);
			console.log(
				`${queryBalance.toString()} LSAN staked on-chain for Queries.`
			);
			console.log(
				`${bytesToMessage(availableStorage)} of data is available for Queries.`
			);
		} catch (e) {
			logger.info(chalk.red('Query Balance Check failed'));
			logger.error(e);
		}
	});

export default queryBalanceCommand;
