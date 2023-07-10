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
import Decimal from 'decimal.js';
import { ethers } from 'ethers';
import jsonfile from 'jsonfile';
import { mkdirp } from 'mkdirp';
import os from 'os';
import path from 'path';

import { appPackageName, appVersion } from './env-config';
import {
	allowanceConfirm,
	bytesToMessage,
	getLogStoreClient,
	logger,
	withRetry,
} from './utils';

interface IConfig {
	privateKey: string;
	host: string;
}

function resolveHome(filepath = '') {
	if (filepath.length > 0 && filepath[0] === '~') {
		return path.join(process.env.HOME, filepath.slice(1));
	}
	return filepath;
}

// define main program
const program = new Command();
let configFilePath = resolveHome('~/.logstore-cli/default.json');

const readFeeMultiplier = 0.05; // See validator code. Should optimised to read from network

program
	.name('Log Store CLI')
	.description(
		'Store event/atomic data and then query by timestamp on the Log Store Network.'
	)
	.version(appVersion)
	.option('-h, --host <string>', 'Polygon/EVM Node RPC Endpoint')
	.option('-w, --wallet <string>', 'Wallet private key')
	.option(
		'-c, --config <string>',
		'Path to configuration file. Defaults to ~/.logstore-cli/default.json'
	)
	.option('-d, --debug', 'Show debug logs')
	.hook('preAction', async (thisCommand) => {
		const { wallet: walletPrivateKey, host, config } = options;
		if (config) {
			configFilePath = resolveHome(config);
		}
		let configData: IConfig = { privateKey: '', host: '' };
		try {
			configData = await jsonfile.readFile(configFilePath);
		} catch (e) {
			// ...
		}
		if (!walletPrivateKey) {
			if (configData.privateKey) {
				options.wallet = configData.privateKey;
			} else {
				throw new Error('Wallet Private Key is invalid');
			}
		}
		if (!host) {
			if (configData.host) {
				options.host = configData.host;
			} else {
				throw new Error('Host RPC Endpoint cannot be empty');
			}
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
	.command('init')
	.description('Creates a configuration file with default parameters')
	.option(
		'-o, --output <string>',
		'The destination file to write the config to.'
	)
	.action(async (cmdOptions: { output: string }) => {
		if (cmdOptions.output) {
			configFilePath = resolveHome(cmdOptions.output);
		}
		const dirPath = configFilePath.substring(
			0,
			configFilePath.lastIndexOf('/')
		);
		await mkdirp(dirPath);
		await jsonfile.writeFile(configFilePath, {
			privateKey: options.wallet,
			host: options.host,
		});
		console.log(`Configuration file saved to ${configFilePath}`);
	});

program
	.command('balance')
	.description(
		'View the LSAN token balance in your wallet, and available storage to use.'
	)
	.option(
		'--divide <number>',
		'To manage a portion of your blanace, you can provide a number to divide your balance by, and the result will print in the response.'
	)
	.action(async (cmdOptions: { divide: number }) => {
		try {
			const provider = new ethers.providers.JsonRpcProvider(options.host);
			const signer = new ethers.Wallet(options.wallet, provider);

			const tokenManagerContract = await getTokenManagerContract(signer);
			const priceBN = await tokenManagerContract.price();
			const balanceBN = await tokenManagerContract.balanceOf(signer.address);
			const balance = new Decimal(balanceBN.toHexString());
			const price = new Decimal(priceBN.toHexString());
			const availableStorage = balance.div(price);
			const availableQueries = balance.div(price.mul(readFeeMultiplier));

			const msgSuffix = `are available to be staked on the Log Store Network.`;

			console.log(
				`The LSAN balance for address ${
					signer.address
				} is ${balance.toString()}.`
			);
			console.log(
				`You should see ${ethers.utils.formatEther(
					balance.toString()
				)} LSAN in your Wallet UI.`
			);
			const storageMsg = bytesToMessage(availableStorage);
			const queriesMsg = bytesToMessage(availableQueries);
			console.log(`${storageMsg} of Storage ${msgSuffix}`);
			console.log(`${queriesMsg} of Queries ${msgSuffix}`);

			if (cmdOptions.divide) {
				const divideBy = new Decimal(cmdOptions.divide);
				const divideResult = balance.div(divideBy);
				console.log();
				console.log(
					`Dividing your balance by ${divideBy} results in: ${divideResult.toString()}`
				);
				console.log(
					`This division yields ${bytesToMessage(
						divideResult.div(price)
					)} available for Storage`
				);
				console.log(
					`This division yields ${bytesToMessage(
						divideResult.div(price.mul(readFeeMultiplier))
					)} available for Queries`
				);
			}
		} catch (e) {
			logger.info(chalk.red('mint failed'));
			logger.error(e);
		}
	});

program
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
	.action(async (amt: string, cmdOptions: { usd: boolean; bytes: boolean }) => {
		const options = program.opts();
		if (cmdOptions.usd && cmdOptions.bytes) {
			throw new Error('Cannot pass USD and BYTES flags together.');
		}
		let amount = new Decimal(amt);
		logger.debug('Command Params: ', { amount, ...options, ...cmdOptions });

		try {
			const provider = new ethers.providers.JsonRpcProvider(options.host);
			const signer = new ethers.Wallet(options.wallet, provider);

			const tokenManagerContract = await getTokenManagerContract(signer);
			const priceBN = await tokenManagerContract.price();
			const price = new Decimal(priceBN.toHexString());

			if (cmdOptions.usd) {
				const usdAmount = await convertFromUsd(
					tokenManagerContract.address,
					amount.toNumber(),
					signer,
					Date.now()
				);
				amount = new Decimal(Number(usdAmount));
			} else if (cmdOptions.bytes) {
				amount = amount.mul(price);
				console.log(
					`Converted request for ${amt} bytes to ${amount.toString()} LSAN tokens.`
				);
				console.log(
					`You should see ${ethers.utils.formatEther(
						amount.toString()
					)} LSAN in your Wallet UI.`
				);
			}
			const tx = await withRetry(provider, (gasPrice) => {
				return tokenManagerContract.mint({
					value: BigInt(amount.toString()),
					gasPrice,
				});
			});
			const receipt = await tx.wait();

			console.log(
				`Successfully minted tokens to network:Tx ${receipt.transactionHash}, Amount:Tx ${amount}`
			);
		} catch (e) {
			logger.info(chalk.red('mint failed'));
			logger.error(e);
		}
	});

program
	.command('query')
	.description('Manage your Log Store Queries')
	.addCommand(
		new Command()
			.name('balance')
			.description('Check your balance staked for Query requests')
			.action(async () => {
				try {
					const provider = new ethers.providers.JsonRpcProvider(options.host);
					const signer = new ethers.Wallet(options.wallet, provider);
					const queryManagerContract = await getQueryManagerContract(signer);

					const tokenManagerContract = await getTokenManagerContract(signer);
					const priceBN = await tokenManagerContract.price();
					const price = new Decimal(priceBN.toHexString());

					const stakedAmount = await queryManagerContract.balanceOf(
						signer.address
					);
					const b = new Decimal(stakedAmount.toHexString());

					const availableStorage = b.div(price.mul(readFeeMultiplier));
					console.log(`${b.toString()} LSAN staked on-chain for Queries.`);
					console.log(
						`This formats to ${ethers.utils.formatEther(
							b.toString()
						)} LSAN in a Wallet UI.`
					);
					console.log(
						`${bytesToMessage(
							availableStorage
						)} of data is available for Queries.`
					);
				} catch (e) {
					logger.info(chalk.red('Query Balance Check failed'));
					logger.error(e);
				}
			})
	)
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
				}
			)
	);

program
	.command('store')
	.description('Manage your Log Stores')
	.addCommand(
		new Command()
			.name('balance')
			.description('Check your balance staked for Storage')
			.action(async () => {
				try {
					const provider = new ethers.providers.JsonRpcProvider(options.host);
					const signer = new ethers.Wallet(options.wallet, provider);
					const storeManagerContract = await getStoreManagerContract(signer);

					const tokenManagerContract = await getTokenManagerContract(signer);
					const priceBN = await tokenManagerContract.price();
					const price = new Decimal(priceBN.toHexString());

					const stakedAmount = await storeManagerContract.balanceOf(
						signer.address
					);
					const b = new Decimal(stakedAmount.toHexString());

					const availableStorage = b.div(price);
					console.log(`${b.toString()} LSAN staked on-chain for Storage.`);
					console.log(
						`This formats to ${ethers.utils.formatEther(
							b.toString()
						)} LSAN in a Wallet UI.`
					);
					console.log(
						`${bytesToMessage(
							availableStorage
						)} of data is available for Storage.`
					);
				} catch (e) {
					logger.info(chalk.red('Storage Balance Check failed'));
					logger.error(e);
				}
			})
	)
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
						const tx = await withRetry(provider, (gasPrice) => {
							return storeManagerContract.stake(streamId, stakeAmount, {
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
