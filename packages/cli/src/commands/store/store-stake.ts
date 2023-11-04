import {
	getCredentialsFromOptions,
	getLogStoreClientFromOptions,
} from '@/utils/logstore-client';
import { allowanceConfirm, logger } from '@/utils/utils';
import { Command } from '@commander-js/extra-typings';
import { prepareStakeForStoreManager } from '@logsn/shared';
import chalk from 'chalk';
import Decimal from 'decimal.js';

const stakeCommand = new Command()
	.name('stake')
	.description(
		'Stake to store data transported over a stream into a decentralised storage network'
	)
	.argument('<streamId>', 'Streamr Stream ID to manage storage for.')
	.argument(
		'<amount>',
		'Amount in Wei to stake into the Query Manager Contract. Ensure funds are available for queries to the Log Store Network.'
	)
	.option(
		'-u, --usd',
		'Pass in an amount in USD which will automatically convert to the appropriate amount of token to stake.'
	)
	.option('-y, --assume-yes', 'Assume Yes to all queries and do not prompt')
	.action(async (streamId, amt, cmdOptions) => {
		// const amount = cmdOptions.usd ? parseFloat(amt) : BigInt(amt);
		if (!streamId) {
			throw new Error('Stream ID is invalid');
		}
		logger.debug('Command Params: ', {
			streamId,
			amount: amt,
			...cmdOptions,
		});

		try {
			const logStoreClient = await getLogStoreClientFromOptions();
			const amountToStakeInWei = cmdOptions.usd
				? await logStoreClient.convert({ amount: amt, from: 'usd', to: 'wei' })
				: amt;

			const { signer } = getCredentialsFromOptions();

			const hexValue = new Decimal(amountToStakeInWei).toHex();

			const stakeAmount = await prepareStakeForStoreManager(
				signer,
				BigInt(hexValue),
				false, // we already converted
				!cmdOptions.assumeYes ? allowanceConfirm : undefined
			);

			logger.info(`Staking ${stakeAmount}...`);

			const tx = await logStoreClient.stakeOrCreateStore(
				streamId,
				BigInt(amountToStakeInWei)
			);
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
