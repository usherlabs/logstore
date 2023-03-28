import ContractAddresses from '@concertodao/logstore-contracts/address.json';
import { abi as NodeManagerContractABI } from '@concertodao/logstore-contracts/artifacts/src/NodeManager.sol/LogStoreNodeManager.json';
// import { abi as QueryManagerContractABI } from '@concertodao/logstore-contracts/artifacts/src/QueryManager.sol/LogStoreQueryManager.json';
// import chalk from 'chalk';
import { ethers } from 'ethers';
import inquirer from 'inquirer';
import redstone from 'redstone-api';
import { Logger } from 'tslog';

import erc20ABI from './abi/erc20';
import { Network } from './types';

export const logger = new Logger();

export const prepareStake = async (
	signer: ethers.Wallet,
	network: string,
	amount: number,
	usd: boolean,
	managerAddress: string
) => {
	if (amount <= 0) {
		throw new Error('Amount must be > 0');
	}

	logger.debug(
		'Contract addresses for Network: ' + Network[network],
		ContractAddresses[Network[network]]
	);
	const nodeManagerContract = new ethers.Contract(
		ContractAddresses[Network[network]].nodeManagerAddress,
		NodeManagerContractABI,
		signer
	);
	const stakeTokenAddress: string =
		await nodeManagerContract.stakeTokenAddress();
	logger.debug('Stake Token Address: ', stakeTokenAddress);
	const stakeTokenContract = new ethers.Contract(
		stakeTokenAddress,
		erc20ABI,
		signer
	);
	const balanceOfSigner = await stakeTokenContract.balanceOf(signer.address);
	logger.debug('Stake Token Balance Of: ', signer.address, balanceOfSigner);
	const stakeTokenSymbol = await stakeTokenContract.symbol();
	logger.debug('Stake Token Symbol: ', stakeTokenSymbol);

	if (true) {
		return amount;
	}

	let realAmount = amount;
	if (usd) {
		logger.info('Converting USD amount to token amount...');
		const stakeTokenDecimals = await stakeTokenContract.decimals();
		logger.debug('Stake Token Decimals: ', stakeTokenDecimals);

		const price = await redstone.getPrice(stakeTokenSymbol);
		const amountInUSD = realAmount / price.value;
		realAmount = Math.floor(
			parseInt(
				ethers.parseUnits(`${amountInUSD}`, stakeTokenDecimals).toString(10),
				10
			)
		);
	}
	logger.info(
		`Fetching allowance of ${stakeTokenSymbol} for ${signer.address}`
	);
	const allowance = await stakeTokenContract.allowance(
		signer.address,
		managerAddress
	);
	if (allowance < realAmount) {
		logger.info(
			`Approving ${
				realAmount - allowance
			} $${stakeTokenSymbol} for ${managerAddress}...`
		);
		await stakeTokenContract.approve(managerAddress, realAmount - allowance);
	}

	logger.info(`Staking ${realAmount} $${stakeTokenSymbol}...`);
	const answers = await inquirer.prompt([
		{
			name: 'confirm',
			type: 'confirm',
			message:
				'Are you sure you want to continue? Once funded, this cannot be reversed.',
			default: true,
		},
	]);
	logger.debug('Prompt Answers: ', answers);
	if (!answers.confirm) {
		process.exit(0);
	}
	return realAmount;
};
