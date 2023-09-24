import { getRootOptions } from '@/commands/options';
import { allowanceConfirm, logger, withRetry } from '@/utils/utils';
import { Command } from '@commander-js/extra-typings';
import {
	getQueryManagerContract,
	prepareStakeForQueryManager,
} from '@logsn/shared';
import chalk from 'chalk';
import { ethers } from 'ethers';

const stakeCommand = new Command()
	.name('stake')
	.description('Stake to submit Query requests to the Log Store Network')
	.argument(
		'<amount>',
		'Amount in Wei to stake into the Query Manager Contract. Ensure funds are available for queries to the Log Store Network.'
	)
	.option(
		'-u, --usd',
		'Pass in an amount in USD which will automatically convert to the appropriate amount of token to stake.'
	)
	.option('-y, --assume-yes', 'Assume Yes to all queries and do not prompt')
	.action(async (amt, cmdOptions) => {
		const rootOptions = getRootOptions();

		const amount = cmdOptions.usd ? parseFloat(amt) : BigInt(amt);
		logger.debug('Command Params: ', {
			amount,
			...rootOptions,
			...cmdOptions,
		});

		try {
			const provider = new ethers.providers.JsonRpcProvider(rootOptions.host);
			const signer = new ethers.Wallet(rootOptions.wallet, provider);
			const stakeAmount = await prepareStakeForQueryManager(
				signer,
				amount,
				cmdOptions.usd,
				!cmdOptions.assumeYes ? allowanceConfirm : undefined
			);
			const queryManagerContract = await getQueryManagerContract(signer);
			logger.info(`Staking ${stakeAmount}...`);

			const tx = await withRetry(provider, (gasPrice) => {
				return queryManagerContract.stake(stakeAmount, {
					gasPrice,
				});
			});
			const receipt = await tx.wait();

			logger.info(
				chalk.green(
					`Successfully staked ${stakeAmount} - Tx: ${receipt.transactionHash}`
				)
			);
		} catch (e) {
			logger.info(chalk.red('Stake failed'));
			logger.error(e);
		}
	});

export default stakeCommand;
