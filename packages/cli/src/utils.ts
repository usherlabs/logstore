import ContractAddresses from '@concertodao/logstore-contracts/address.json';
import { abi as NodeManagerContractABI } from '@concertodao/logstore-contracts/artifacts/src/NodeManager.sol/LogStoreNodeManager.json';
import { BigNumber } from '@ethersproject/bignumber';
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
	// const balanceOfSigner = await stakeTokenContract.balanceOf(signer.address);
	// logger.debug('Stake Token Balance Of: ', signer.address, balanceOfSigner);
	const stakeTokenSymbol = await stakeTokenContract.symbol();
	logger.debug('Stake Token Symbol: ', stakeTokenSymbol);

	let realAmount = amount;
	if (usd) {
		logger.info('Converting USD amount to token amount...');
		const stakeTokenDecimals = BigNumber.from(
			await stakeTokenContract.decimals()
		);
		logger.debug('Stake Token Decimals: ', stakeTokenDecimals.toNumber());

		let price = 0.01;
		try {
			const rsResp = await redstone.getPrice(stakeTokenSymbol);
			price = rsResp.value;
		} catch (e) {
			logger.warn(`Cannot get price of ${stakeTokenSymbol} from RedStone`);
		}
		const amountInUSD = realAmount / price;
		realAmount = Math.floor(
			parseInt(
				ethers
					.parseUnits(`${amountInUSD}`, stakeTokenDecimals.toNumber())
					.toString(10),
				10
			)
		);
	}
	logger.info(
		`Fetching allowance of ${stakeTokenSymbol} for ${signer.address}`
	);
	const allowance = BigNumber.from(
		await stakeTokenContract.allowance(signer.address, managerAddress)
	);
	logger.debug(`Current allowance: ${allowance.toNumber()}`);
	const bnAmount = BigNumber.from(realAmount);
	logger.debug(
		allowance.lt(bnAmount) ? `Approval is required` : `Approval is NOT required`
	);
	if (allowance.lt(bnAmount)) {
		const approvalAmount = bnAmount.sub(allowance);
		logger.info(
			`Approving ${approvalAmount.toNumber()} (${
				approvalAmount.toNumber() / Math.pow(10, 18)
			}) $${stakeTokenSymbol} for ${managerAddress}...`
		);
		await stakeTokenContract.approve(managerAddress, approvalAmount.toNumber());
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
