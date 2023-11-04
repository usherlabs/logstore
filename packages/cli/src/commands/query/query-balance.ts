import { readFeeMultiplier } from '@/configuration';
import { getLogStoreClientFromOptions } from '@/utils/logstore-client';
import { bytesToMessage, logger } from '@/utils/utils';
import { Command } from '@commander-js/extra-typings';
import chalk from 'chalk';
import Decimal from 'decimal.js';
import { ethers } from 'ethers';

const queryBalanceCommand = new Command()
	.name('balance')
	.description('Check your balance staked for Query requests')
	.action(async () => {
		try {
			const client = getLogStoreClientFromOptions();
			const price = new Decimal((await client.getPrice()).toString());

			const queryBalance = new Decimal(
				(await client.getQueryBalance()).toString()
			);

			const availableStorage = queryBalance.div(price.mul(readFeeMultiplier));
			console.log(
				`${queryBalance.toString()} LSAN staked on-chain for Queries.`
			);
			console.log(
				`This formats to ${ethers.utils.formatEther(
					queryBalance.toHex()
				)} LSAN in a Wallet UI.`
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
