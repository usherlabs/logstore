import { getRootOptions } from '@/commands/options';
import { fastPriorityIfMainNet$ } from '@/utils/gasStation';
import {
	getClientsFromOptions,
	getCredentialsFromOptions,
} from '@/utils/logstore-client';
import { keepRetryingWithIncreasedGasPrice } from '@/utils/speedupTx';
import {
	getTransferAmountFromEcr2Transfer,
	logger,
	printContractFailReason,
	printPrices,
	printTransactionFee,
	printTransactionLink,
} from '@/utils/utils';
import { Command } from '@commander-js/extra-typings';
import chalk from 'chalk';
import Decimal from 'decimal.js';
import { firstValueFrom } from 'rxjs';

export const mintCommand = new Command()
	.command('mint')
	.description('Mint LSAN tokens for the Log Store Network')
	.argument(
		'<amount>',
		'Amount of MATIC (default) or USD (in MATIC) or Bytes (in MATIC) to exchange for LSAN.'
	)
	.option(
		'-u, --usd',
		'Pass in an amount in USD which will automatically convert to the appropriate amount of token to mint.'
	)
	.option(
		'-b, --bytes',
		'Pass in an amount of bytes that you would like to store. This will automatically convert to the appropriate amount of token to mint.'
	)
	.action(async (amount: string, cmdOptions) => {
		const rootOptions = getRootOptions();

		if (cmdOptions.usd && cmdOptions.bytes) {
			throw new Error('Cannot pass USD and BYTES flags together.');
		}
		logger.debug('Command Params: ', { amount, ...rootOptions, ...cmdOptions });
		const { signer, provider } = getCredentialsFromOptions();

		try {
			const { logStoreClient } = getClientsFromOptions();

			const mintType = cmdOptions.usd
				? 'usd'
				: cmdOptions.bytes
				? 'bytes'
				: 'wei';

			await printPrices();

			const amountInToken = await logStoreClient.convert({
				amount,
				from: mintType,
				to: 'wei',
			});

			console.log(`Minting ${amountInToken} wei...`);
			const result = await logStoreClient.mint(
				BigInt(new Decimal(amountInToken).toHex()),
				{
					maxPriorityFeePerGas: await firstValueFrom(fastPriorityIfMainNet$),
				}
			);

			console.log(
				`Waiting for transaction ${chalk.underline(result.hash)} to be mined...`
			);

			const receipt = await firstValueFrom(
				keepRetryingWithIncreasedGasPrice(signer, result)
			);

			console.log('');
			console.log(`Successfully minted tokens to network.`);
			console.log(`Tx ${receipt.transactionHash}`);

			console.log('');
			console.log(`Waiting more confirmations...`);

			await provider.waitForTransaction(receipt.transactionHash, 3);

			console.log('Mint confirmed.');
			await printTransactionFee(receipt);
			const resultingLSAN = await getTransferAmountFromEcr2Transfer(receipt);
			console.log(`Minted ${resultingLSAN} LSAN`);

			await printTransactionLink(receipt);
		} catch (e: unknown) {
			console.log(chalk.red('mint failed'));
			printContractFailReason(e);

			logger.error(e);
		}
	});
