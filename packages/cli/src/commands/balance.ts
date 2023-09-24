import { readFeeMultiplier } from '@/configuration';
import { getLogStoreClientFromOptions } from '@/utils/logstore-client';
import { bytesToMessage, logger } from '@/utils/utils';
import { Command } from '@commander-js/extra-typings';
import chalk from 'chalk';
import Decimal from 'decimal.js';
import { ethers } from 'ethers';

export const balanceCommand = new Command()
	.command('balance')
	.description(
		'View the LSAN token balance in your wallet, and available storage to use.'
	)
	.option(
		'--divide <number>',
		'To manage a portion of your blanace, you can provide a number to divide your balance by, and the result will print in the response.'
	)
	.action(async (cmdOptions) => {
		try {
			const client = getLogStoreClientFromOptions();
			const balance = new Decimal((await client.getBalance()).toString());
			const price = new Decimal((await client.getPrice()).toString());

			const availableStorage = balance.div(price);
			const availableQueries = balance.div(price.mul(readFeeMultiplier));

			const msgSuffix = `are available to be staked on the Log Store Network.`;

			console.log(
				`The LSAN balance for address ${await client.getAddress()} is ${balance.toString()}.`
			);
			console.log(
				`You should see ${ethers.utils.formatEther(
					balance.toHex()
				)} LSAN in your Wallet UI.`
			);
			const storageMsg = bytesToMessage(availableStorage);
			const queriesMsg = bytesToMessage(availableQueries);
			console.log(`${storageMsg} of Storage ${msgSuffix}`);
			console.log(`${queriesMsg} of Queries ${msgSuffix}`);

			if (cmdOptions.divide) {
				const divideBy = new Decimal(cmdOptions.divide);
				const divideResult = balance.div(divideBy);
				console.log();
				console.log(
					`Dividing your balance by ${divideBy} results in: ${divideResult.toString()}`
				);
				console.log(
					`This division yields ${bytesToMessage(
						divideResult.div(price)
					)} available for Storage`
				);
				console.log(
					`This division yields ${bytesToMessage(
						divideResult.div(price.mul(readFeeMultiplier))
					)} available for Queries`
				);
			}
		} catch (e) {
			logger.info(chalk.red('failed to check your balance'));
			logger.error(e);
		}
	});
