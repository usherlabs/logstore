import { getLogStoreClientFromOptions } from '@/utils/logstore-client';
import { bytesToMessage, logger } from '@/utils/utils';
import { Command } from '@commander-js/extra-typings';
import chalk from 'chalk';
import Decimal from 'decimal.js';
import { ethers } from 'ethers';

const balanceCommand = new Command()
	.name('balance')
	.description('Check your balance staked for Storage')
	.action(async () => {
		try {
			const client = getLogStoreClientFromOptions();
			const price = new Decimal((await client.getPrice()).toString());

			const storeBalance = new Decimal(
				(await client.getStoreBalance()).toString()
			);

			const availableStorage = storeBalance.div(price);
			console.log(
				`${storeBalance.toString()} LSAN staked on-chain for Storage.`
			);
			console.log(
				`This formats to ${ethers.utils.formatEther(
					storeBalance.toString()
				)} LSAN in a Wallet UI.`
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
