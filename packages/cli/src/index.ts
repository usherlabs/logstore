import ContractAddresses from '@concertodao/logstore-contracts/address.json';
import { abi as NodeManagerContractABI } from '@concertodao/logstore-contracts/artifacts/src/NodeManager.sol/LogStoreNodeManager.json';
import { abi as QueryManagerContractABI } from '@concertodao/logstore-contracts/artifacts/src/QueryManager.sol/LogStoreQueryManager.json';
import chalk from 'chalk';
import { Command } from 'commander';
import { ethers } from 'ethers';
import inquirer from 'inquirer';
import os from 'os';
import redstone from 'redstone-api';
import { Logger } from 'tslog';

import erc20ABI from './abi/erc20';
import { appPackageName, appVersion } from './env-config';

enum Network {
	Local = 5,
	Dev = 8997,
	Testnet = 80001,
	Mainnet = 137,
}

const logger = new Logger();

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
			logger.settings.minLevel = 5;
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
			.action(async (amt: string, { usd }: { usd: boolean }) => {
				const amount = parseFloat(amt);
				const { wallet: walletPrivateKey, host, network } = options;
				if (amount <= 0) {
					throw new Error('Amount must be > 0');
				}

				const provider = new ethers.JsonRpcProvider(host);
				const signer = new ethers.Wallet(walletPrivateKey, provider);
				console.log(
					'Contract addresses for Network: ' + Network[network],
					ContractAddresses[Network[network]]
				);
				logger.debug(
					'Contract addresses for Network: ' + Network[network],
					ContractAddresses[Network[network]]
				);
				// const queryManagerContract = new ethers.Contract(
				// 	ContractAddresses[Network[network]].queryManagerAddress,
				// 	QueryManagerContractABI,
				// 	signer
				// );
				const nodeManagerContract = new ethers.Contract(
					ContractAddresses[Network[network]].nodeManagerAddress,
					NodeManagerContractABI,
					signer
				);
				const stakeTokenAddress: string =
					await nodeManagerContract.stakeTokenAddress();
				const stakeTokenContract = new ethers.Contract(
					stakeTokenAddress,
					erc20ABI,
					signer
				);
				const stakeTokenSymbol = await stakeTokenContract.symbol();
				let realAmount = amount;
				if (usd) {
					logger.info('Converting USD amount to token amount...');
					const stakeTokenDecimals = await stakeTokenContract.decimals();

					const price = await redstone.getPrice(stakeTokenSymbol);
					const amountInUSD = realAmount / price.value;
					realAmount = Math.floor(
						parseInt(
							ethers
								.parseUnits(`${amountInUSD}`, stakeTokenDecimals)
								.toString(10),
							10
						)
					);
				}
				const allowance = await stakeTokenContract.allowance(
					signer.address,
					ContractAddresses[Network[network]].queryManagerAddress
				);
				if (allowance < realAmount) {
					logger.info(
						`Approving ${realAmount - allowance} $${stakeTokenSymbol}...`
					);
					// await stakeTokenContract.approve(
					// 	ContractAddresses[Network[network]].queryManagerAddress,
					// 	realAmount - allowance
					// );
				}
				logger.info(`Staking ${realAmount} $${stakeTokenSymbol}...`);
				inquirer
					.prompt([
						{
							type: 'confirm',
							message:
								'Are you sure you want to continue? Once funded, this cannot be reversed.',
							default: true,
						},
					])
					.then((answers) => {
						logger.info(answers);
						// await queryManagerContract.stake(realAmount);
						// logger.info(
						// 	chalk.green(`Successfully staked ${realAmount} $${stakeTokenSymbol}!`)
						// );
					})
					.catch((e) => {
						logger.info(chalk.red('Stake failed'));
						console.error(e);
					});
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
				async (streamId: string, amt: string, { usd }: { usd: boolean }) => {
					const amount = parseFloat(amt);
					const { wallet: walletPrivateKey, host, network } = options;
					if (!streamId) {
						throw new Error('Stream ID is invalid');
					}
					if (amount <= 0) {
						throw new Error('Amount must be > 0');
					}

					const provider = new ethers.JsonRpcProvider(host);
					const signer = new ethers.Wallet(walletPrivateKey, provider);
					const storeManagerContract = new ethers.Contract(
						ContractAddresses[Network[network]].storeManagerAddress,
						QueryManagerContractABI,
						signer
					);
					const nodeManagerContract = new ethers.Contract(
						ContractAddresses[Network[network]].nodeManagerAddress,
						NodeManagerContractABI,
						signer
					);
					const stakeTokenAddress: string =
						await nodeManagerContract.stakeTokenAddress();
					const stakeTokenContract = new ethers.Contract(
						stakeTokenAddress,
						erc20ABI,
						signer
					);
					const stakeTokenSymbol = await stakeTokenContract.symbol();
					let realAmount = amount;
					if (usd) {
						logger.info('Converting USD amount to token amount...');
						const stakeTokenDecimals = await stakeTokenContract.decimals();

						const price = await redstone.getPrice(stakeTokenSymbol);
						const amountInUSD = realAmount / price.value;
						realAmount = Math.floor(
							parseInt(
								ethers
									.parseUnits(`${amountInUSD}`, stakeTokenDecimals)
									.toString(10),
								10
							)
						);
					}
					const allowance = await stakeTokenContract.allowance(
						signer.address,
						ContractAddresses[Network[network]].queryManagerAddress
					);
					if (allowance < realAmount) {
						logger.info(
							`Approving ${realAmount - allowance} $${stakeTokenSymbol}...`
						);
						await stakeTokenContract.approve(
							ContractAddresses[Network[network]].queryManagerAddress,
							realAmount - allowance
						);
					}
					logger.info(`Staking ${realAmount} $${stakeTokenSymbol}...`);
					await storeManagerContract.stake(realAmount);
					logger.info(
						chalk.green(
							`Successfully staked ${realAmount} $${stakeTokenSymbol}!`
						)
					);
				}
			)
	);

program.configureHelp({
	showGlobalOptions: true,
});

const options = program.opts();

program.parse();
