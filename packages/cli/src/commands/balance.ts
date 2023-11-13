import { readFeeMultiplier } from '@/configuration';
import { getLogStoreClientFromOptions } from '@/utils/logstore-client';
import { bytesToMessage, logger } from '@/utils/utils';
import { Command } from '@commander-js/extra-typings';
import chalk, { bold } from 'chalk';
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
			const balanceInLSAN = new Decimal((await client.getBalance()).toString());
			const price = new Decimal((await client.getPrice()).toString());

			// TODO review this when multiplier from contract != 1
			const availableStorage = balanceInLSAN;
			const availableQueries = balanceInLSAN.div(readFeeMultiplier);

			const msgSuffix = `are available to be staked on the Log Store Network.`;

			console.log(
				`The LSAN balance for address ${bold(
					await client.getAddress()
				)} is ${bold(balanceInLSAN.toString())}.`
			);
			console.log(
				`You should see ${bold(
					ethers.utils.formatEther(balanceInLSAN.toHex())
				)} LSAN in your Wallet UI.`
			);
			const storageMsg = bytesToMessage(availableStorage);
			const queriesMsg = bytesToMessage(availableQueries);

			console.log('');
			console.log('Which could be staked into the LogStore Network as:');
			console.log(`${storageMsg} of Storage`);
			console.log(`${queriesMsg} of Queries`);

			if (cmdOptions.divide) {
				const divideBy = new Decimal(cmdOptions.divide);
				const divideResult = balanceInLSAN.div(divideBy);
				console.log();
				console.log(
					chalk.green(
						`Dividing your balance by ${divideBy} results in: ${divideResult.toString()}`
					)
				);
				console.log(
					`This division yields ${bytesToMessage(
						divideResult
					)} available for Storage`
				);
				console.log(
					`This division yields ${bytesToMessage(
						divideResult.div(readFeeMultiplier)
					)} available for Queries`
				);
			}
		} catch (e) {
			console.log(chalk.red('failed to check your balance'));
			logger.error(e);
		}
	});
