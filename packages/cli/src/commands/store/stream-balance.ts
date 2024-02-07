import { getClientsFromOptions } from '@/utils/logstore-client';
import { bytesToMessage, logger } from '@/utils/utils';
import { Command } from '@commander-js/extra-typings';
import chalk from 'chalk';
import Decimal from 'decimal.js';
import { ethers } from 'ethers';

const balanceCommand = new Command()
	.name('stream-balance')
	.description('Check the balance staked for Storage on a Stream')
	.argument('<streamId>', 'Streamr Stream ID to manage storage for.')
	.action(async (streamId) => {
		if (!streamId) {
			throw new Error('Stream ID is invalid');
		}

		try {
			const { streamrClient, logStoreClient } = getClientsFromOptions();

			using cleanup = new DisposableStack();
			cleanup.defer(() => {
				logStoreClient.destroy();
				streamrClient.destroy();
			});

			const price = new Decimal((await logStoreClient.getPrice()).toString());

			const streamBalance = new Decimal(
				(await logStoreClient.getStreamBalance(streamId)).toString()
			);

			const availableStorage = streamBalance.div(price);
			console.log(
				`${streamBalance.toString()} LSAN staked on-chain for Storage.`
			);
			console.log(
				`This formats to ${ethers.utils.formatEther(
					streamBalance.toString()
				)} LSAN in a Wallet UI.`
			);
			console.log(
				`${bytesToMessage(
					availableStorage
				)} of data is available for Storage on stream.`
			);
		} catch (e) {
			logger.info(chalk.red('Stream Storage Balance Check failed'));
			logger.error(e);
		}
	});

export default balanceCommand;
