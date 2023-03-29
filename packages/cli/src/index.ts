import ContractAddresses from '@concertodao/logstore-contracts/address.json';
import { abi as QueryManagerContractABI } from '@concertodao/logstore-contracts/artifacts/src/QueryManager.sol/LogStoreQueryManager.json';
import { abi as StoreManagerContractABI } from '@concertodao/logstore-contracts/artifacts/src/StoreManager.sol/LogStoreManager.json';
import chalk from 'chalk';
import { Command } from 'commander';
import { ethers } from 'ethers';
import os from 'os';

import { appPackageName, appVersion } from './env-config';
import { Network } from './types';
import { logger, prepareStake } from './utils';

// define main program
const program = new Command();

program
	.name('Log Store CLI')
	.description('Query and Store on the Log Store Network.')
	.version(appVersion)
	.option('-h, --host <string>', 'Polygon/EVM Node RPC Endpoint')
	.option('-w, --wallet <string>', 'Wallet private key')
	.option(
		'-n, --network <string>',
		`Network to interact with. ie. Local, Dev, Testnet, Mainnet`,
		'Dev'
	)
	.option('-d, --debug', 'Show debug logs')
	.hook('preAction', (thisCommand) => {
		const { wallet: walletPrivateKey, host } = options;
		if (walletPrivateKey <= 0) {
			throw new Error('Wallet Private Key is invalid');
		}
		if (!host) {
			throw new Error('Host RPC Endpoint cannot be empty');
		}

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
			.action(async (amt: string, cmdOptions: { usd: boolean }) => {
				const amount = parseFloat(amt);
				logger.debug('Command Params: ', { amount, ...options, ...cmdOptions });

				try {
					const provider = new ethers.JsonRpcProvider(options.host);
					const signer = new ethers.Wallet(options.wallet, provider);
					const { queryManagerAddress } =
						ContractAddresses[Network[options.network]];
					const stakeAmount = await prepareStake(
						signer,
						options.network,
						amount,
						cmdOptions.usd,
						queryManagerAddress
					);
					const queryManagerContract = new ethers.Contract(
						queryManagerAddress,
						QueryManagerContractABI,
						signer
					);
					await queryManagerContract.stake(stakeAmount);
					logger.info(
						chalk.green(
							`Successfully staked ${stakeAmount.toString()} in ${queryManagerAddress}`
						)
					);
				} catch (e) {
					logger.info(chalk.red('Stake failed'));
					logger.error(e);
				}
			})
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
			.action(
				async (streamId: string, amt: string, cmdOptions: { usd: boolean }) => {
					const amount = parseFloat(amt);
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
						const provider = new ethers.JsonRpcProvider(options.host);
						const signer = new ethers.Wallet(options.wallet, provider);
						const { storeManagerAddress } =
							ContractAddresses[Network[options.network]];
						const stakeAmount = await prepareStake(
							signer,
							options.network,
							amount,
							cmdOptions.usd,
							storeManagerAddress
						);
						const storeManagerContract = new ethers.Contract(
							storeManagerAddress,
							StoreManagerContractABI,
							signer
						);
						await storeManagerContract.stake(streamId, stakeAmount);
						logger.info(
							chalk.green(
								`Successfully staked ${stakeAmount} in ${storeManagerAddress}`
							)
						);
					} catch (e) {
						logger.info(chalk.red('Stake failed'));
						logger.error(e);
					}
				}
			)
	);

program.configureHelp({
	showGlobalOptions: true,
});

const options = program.opts();

program.parse();
