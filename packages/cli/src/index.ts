import {
	convertFromUsd,
	getQueryManagerContract,
	getStoreManagerContract,
	getTokenManagerContract,
	prepareStakeForQueryManager,
	prepareStakeForStoreManager,
} from '@logsn/shared';
import chalk from 'chalk';
import { Command } from 'commander';
import { ethers } from 'ethers';
import os from 'os';

import { appPackageName, appVersion } from './env-config';
import { allowanceConfirm, getLogStoreClient, logger } from './utils';

// define main program
const program = new Command();

program
	.name('Log Store CLI')
	.description('Query and Store on the Log Store Network.')
	.version(appVersion)
	.option('-h, --host <string>', 'Polygon/EVM Node RPC Endpoint')
	.option('-w, --wallet <string>', 'Wallet private key')
	// .option(
	// 	'-n, --network <string>',
	// 	`Network to interact with. ie. Local, Dev, Testnet, Mainnet`,
	// 	'Mainnet'
	// )
	.option('-d, --debug', 'Show debug logs')
	.hook('preAction', (thisCommand) => {
		const { wallet: walletPrivateKey, host } = options;
		if (walletPrivateKey <= 0) {
			throw new Error('Wallet Private Key is invalid');
		}
		if (!host) {
			throw new Error('Host RPC Endpoint cannot be empty');
		}

		logger.settings.minLevel = 3;
		if (thisCommand.opts().debug) {
			logger.settings.minLevel = 0;
		}
	});

// define version command
program
	.command('version')
	.description('Print runtime and protocol version')
	.action(() => {
		console.log(`${appPackageName} version: ${appVersion}`);
		console.log(`Node version: ${process.version}`);
		console.log();
		console.log(`Platform: ${os.platform()}`);
		console.log(`Arch: ${os.arch()}`);
	});

program
	.command('mint')
	.description('Manage minting tokens for the Log Store Network')
	.addCommand(
		new Command()
			.name('lsan')
			.description('Mint LSAN tokens for the Log Store Network.')
			.argument(
				'<amount>',
				'Amount of Native Blockchain Currency (in Wei) to exchange for LSAN. Note that 10 MATIC = 1000000000000000000 Wei'
			)
			.option(
				'-u, --usd',
				'Pass in an amount in USD which will automatically convert to the appropriate amount of token to stake.'
			)
			.action(async (amt: string, cmdOptions: { usd: boolean }) => {
				let amount = cmdOptions.usd ? parseFloat(amt) : BigInt(amt);
				logger.debug('Command Params: ', { amount, ...options, ...cmdOptions });

				try {
					const provider = new ethers.providers.JsonRpcProvider(options.host);
					const signer = new ethers.Wallet(options.wallet, provider);

					const tokenManagerContract = await getTokenManagerContract(signer);

					if (cmdOptions.usd) {
						amount = await convertFromUsd(
							tokenManagerContract.address,
							Number(amount),
							signer,
							Date.now()
						);
					}
					const receipt = await (
						await tokenManagerContract.mint({ value: BigInt(amount) })
					).wait();

					console.log(
						`Successfully minted tokens to network:Tx ${receipt.transactionHash}, Amount:Tx ${amount}`
					);
				} catch (e) {
					logger.info(chalk.red('mint failed'));
					logger.error(e);
				}
			})
	);

program
	.command('query')
	.description('Manage your Log Store Queries')
	.addCommand(
		new Command()
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
			.action(
				async (
					amt: string,
					cmdOptions: { usd: boolean; assumeYes: boolean }
				) => {
					const amount = cmdOptions.usd ? parseFloat(amt) : BigInt(amt);
					logger.debug('Command Params: ', {
						amount,
						...options,
						...cmdOptions,
					});

					try {
						const provider = new ethers.providers.JsonRpcProvider(options.host);
						const signer = new ethers.Wallet(options.wallet, provider);
						const stakeAmount = await prepareStakeForQueryManager(
							signer,
							amount,
							cmdOptions.usd,
							!cmdOptions.assumeYes ? allowanceConfirm : undefined
						);
						const queryManagerContract = await getQueryManagerContract(signer);
						logger.info(`Staking ${stakeAmount}...`);
						await (await queryManagerContract.stake(stakeAmount)).wait();
						logger.info(chalk.green(`Successfully staked ${stakeAmount}`));
					} catch (e) {
						logger.info(chalk.red('Stake failed'));
						logger.error(e);
					}
				}
			)
	);

program
	.command('store')
	.description('Manage your Log Stores')
	.addCommand(
		new Command()
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
			.action(
				async (
					streamId: string,
					amt: string,
					cmdOptions: { usd: boolean; assumeYes: boolean }
				) => {
					const amount = cmdOptions.usd ? parseFloat(amt) : BigInt(amt);
					if (!streamId) {
						throw new Error('Stream ID is invalid');
					}
					logger.debug('Command Params: ', {
						streamId,
						amount,
						...options,
						...cmdOptions,
					});

					try {
						const provider = new ethers.providers.JsonRpcProvider(options.host);
						const signer = new ethers.Wallet(options.wallet, provider);

						const stakeAmount = await prepareStakeForStoreManager(
							signer,
							amount,
							cmdOptions.usd,
							!cmdOptions.assumeYes ? allowanceConfirm : undefined
						);
						const storeManagerContract = await getStoreManagerContract(signer);
						logger.info(`Staking ${stakeAmount}...`);
						await (
							await storeManagerContract.stake(streamId, stakeAmount)
						).wait();
						logger.info(chalk.green(`Successfully staked ${stakeAmount}`));
					} catch (e) {
						logger.info(chalk.red('Stake failed'));
						logger.error(e);
					}
				}
			)
	);

program
	.command('create-stream')
	.description(
		'Create Streamr stream to start storing data transported over the stream.'
	)
	.argument('<name>', 'Streamr stream name - ie. your_id/stream_name.')
	.action(async (name: string) => {
		// const provider = new ethers.providers.JsonRpcProvider(options.host);
		// const signer = new ethers.Wallet(options.wallet, provider);
		const client = getLogStoreClient(options.wallet);
		const stream = await client.createStream({
			// id: name.charAt(0) === '/' ? name : `/${name}`,
			id: name,
		});
		logger.info(stream);
	});

program.configureHelp({
	showGlobalOptions: true,
});

const options = program.opts();

program.parse();
