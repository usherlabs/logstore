import { getRootOptions } from '@/commands/options';
import { fastPriorityIfMainNet$ } from '@/utils/gasStation';
import {
	getClientsFromOptions,
	getCredentialsFromOptions,
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
import {
	getQueryManagerContract,
	Manager,
	requestAllowanceIfNeeded,
} from '@logsn/shared';
import chalk from 'chalk';
import Decimal from 'decimal.js';
import { firstValueFrom } from 'rxjs';

const stakeCommand = new Command()
	.name('stake')
	.description('Stake to submit Query requests to the Log Store Network')
	.argument(
		'<amount>',
		'Amount in LSAN to stake into the Query Manager Contract. Ensure funds are available for queries to the Log Store Network.'
	)
	.option(
		'-u, --usd',
		'Pass in an amount in USD which will automatically convert to the appropriate amount of token to stake.'
	)
	.option('-y, --assume-yes', 'Assume Yes to all queries and do not prompt')
	.action(async (amt, cmdOptions) => {
		const rootOptions = getRootOptions();
		const { logStoreClient } = getClientsFromOptions();

		using cleanup = new DisposableStack();
		cleanup.defer(() => {
			logStoreClient.streamrClient.destroy();
			logStoreClient.destroy();
		});

		const amountToStakeInLSAN = cmdOptions.usd
			? // todo: 1 LSAN = 1 by here
				await logStoreClient
					.convert({
						amount: amt,
						from: 'usd',
						to: 'bytes',
					})
					.then((v) => new Decimal(v))
			: amt;

		const hexValue = new Decimal(amountToStakeInLSAN).toHex();

		logger.debug('Command Params: ', {
			amountToStakeInLSAN,
			amt,
			...rootOptions,
			...cmdOptions,
		});

		try {
			const { signer } = getCredentialsFromOptions();

			console.log('Checking for available allowance...');
			const allowanceTx = await requestAllowanceIfNeeded(
				Manager.QueryManager,
				BigInt(hexValue),
				signer,
				!cmdOptions.assumeYes ? allowanceConfirm : undefined,
				{
					maxPriorityFeePerGas: await firstValueFrom(fastPriorityIfMainNet$),
				}
			);

			if (allowanceTx) {
				console.log('');
				console.info('Waiting for allowance transaction to be mined...');
				await firstValueFrom(
					keepRetryingWithIncreasedGasPrice(signer, allowanceTx)
				);
				console.info('Allowance transaction mined');
				console.log('');
			} else {
				logger.debug('No additional allowance needed');
			}

			await checkLSANFunds(amountToStakeInLSAN.toString());
			const queryManagerContract = await getQueryManagerContract(signer);
			console.info(`Staking ${amountToStakeInLSAN} LSAN...`);

			const tx = await queryManagerContract.stake(hexValue, {
				maxPriorityFeePerGas: await firstValueFrom(fastPriorityIfMainNet$),
			});

			const receipt = await firstValueFrom(
				keepRetryingWithIncreasedGasPrice(signer, tx)
			);

			console.log('');
			console.info(`Successfully staked ${amountToStakeInLSAN} LSAN for Query`);
			console.log(`Tx: ${receipt.transactionHash}`);
			console.log('');

			await printTransactionFee(receipt);

			await printTransactionLink(receipt);
		} catch (e) {
			console.info(chalk.red('Stake failed'));
			printContractFailReason(e);
			logger.error(e);
		}
	});

export default stakeCommand;
