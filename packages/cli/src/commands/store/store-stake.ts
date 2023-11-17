import { fastPriorityIfMainNet$ } from '@/utils/gasStation';
import {
	getCredentialsFromOptions,
	getLogStoreClientFromOptions,
} from '@/utils/logstore-client';
import { keepRetryingWithIncreasedGasPrice } from '@/utils/speedupTx';
import {
	allowanceConfirm,
	checkLSANFunds,
	logger,
	printContractFailReason,
	printTransactionFee,
	printTransactionLink,
} from '@/utils/utils';
import { Command } from '@commander-js/extra-typings';
import { Manager, requestAllowanceIfNeeded } from '@logsn/shared';
import chalk from 'chalk';
import Decimal from 'decimal.js';
import { firstValueFrom } from 'rxjs';

const stakeCommand = new Command()
	.name('stake')
	.description(
		'Stake to store data transported over a stream into a decentralised storage network'
	)
	.argument('<streamId>', 'Streamr Stream ID to manage storage for.')
	.argument(
		'<amount>',
		'Amount in LSAN to stake into the Query Manager Contract. Ensure funds are available for queries to the Log Store Network.'
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
			const logStoreClient = getLogStoreClientFromOptions();
			const amountToStakeInLSAN = cmdOptions.usd
				? // todo this assumes the price is 1:1 (multiplier)
				  await logStoreClient.convert({
						amount: amt,
						from: 'usd',
						to: 'bytes',
				  })
				: amt;

			const { signer } = getCredentialsFromOptions();

			const hexValue = new Decimal(amountToStakeInLSAN).toHex();

			await checkLSANFunds(hexValue);

			console.log('Checking for available allowance...');
			const allowanceTx = await requestAllowanceIfNeeded(
				Manager.StoreManager,
				BigInt(hexValue),
				signer,
				!cmdOptions.assumeYes ? allowanceConfirm : undefined,
				{
					maxPriorityFeePerGas: await firstValueFrom(fastPriorityIfMainNet$),
				}
			);

			if (allowanceTx) {
				console.info('Waiting for allowance transaction to be mined...');
				await firstValueFrom(
					keepRetryingWithIncreasedGasPrice(signer, allowanceTx)
				);
				console.info('Allowance transaction mined');
			} else {
				logger.debug('No additional allowance needed');
			}

			console.info(`Staking ${amountToStakeInLSAN} LSAN...`);

			const tx = await logStoreClient.stakeOrCreateStore(
				streamId,
				BigInt(amountToStakeInLSAN),
				{
					maxPriorityFeePerGas: await firstValueFrom(fastPriorityIfMainNet$),
				}
			);
			const receipt = await firstValueFrom(
				keepRetryingWithIncreasedGasPrice(signer, tx)
			);

			console.log('');
			console.info(
				`Successfully staked ${amountToStakeInLSAN} LSAN for Storage`
			);
			console.log(`Tx: ${receipt.transactionHash}`);
			console.log('');

			await printTransactionFee(receipt);

			await printTransactionLink(receipt);
		} catch (e) {
			console.info(chalk.red('Stake failed'));
			printContractFailReason(e);
			console.error(e);
		}
	});

export default stakeCommand;
