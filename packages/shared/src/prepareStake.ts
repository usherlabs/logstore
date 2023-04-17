import { ERC20__factory } from '@concertodao/logstore-contracts';
import { Signer } from 'ethers';
import { Logger } from 'tslog';

import { allowanceConfirmFn, ensureEnoughAllowance } from './allowance';
import { convertFromUsd } from './convertFromUsd';
import { getManagerContract } from './getManager';
import { Manager } from './types';

export const logger = new Logger();

export async function prepareStakeForNodeManager(
	signer: Signer,
	amount: bigint | number,
	isUsd?: boolean,
	confirm?: allowanceConfirmFn
) {
	return prepareStake(Manager.NodeManager, signer, amount, isUsd, confirm);
}

export async function prepareStakeForStoreManager(
	signer: Signer,
	amount: bigint | number,
	isUsd?: boolean,
	confirm?: allowanceConfirmFn
) {
	return prepareStake(Manager.StoreManager, signer, amount, isUsd, confirm);
}

export async function prepareStakeForQueryManager(
	signer: Signer,
	amount: bigint | number,
	isUsd?: boolean,
	confirm?: allowanceConfirmFn
) {
	return prepareStake(Manager.QueryManager, signer, amount, isUsd, confirm);
}

async function prepareStake(
	manager: Exclude<Manager, Manager.ReportManager>,
	signer: Signer,
	amount: bigint | number,
	isUsd?: boolean,
	confirm?: allowanceConfirmFn
) {
	if (amount <= 0) {
		throw new Error('Amount must be > 0');
	}

	const managerContract = await getManagerContract(signer, manager);
	// @ts-ignore -- manager excludes ReportManager
	const stakeTokenAddress: string = await managerContract.stakeTokenAddress();
	logger.debug('Stake Token Address: ', stakeTokenAddress);

	const stakeTokenContract = ERC20__factory.connect(stakeTokenAddress, signer);
	const stakeTokenSymbol = await stakeTokenContract.symbol();
	logger.debug('Stake Token Symbol: ', stakeTokenSymbol);

	logger.debug(`${manager} Contract Address: `, managerContract.address);

	let realAmount = amount;
	if (isUsd) {
		realAmount = await convertFromUsd(
			stakeTokenAddress,
			amount as number,
			signer
		);
	}

	const bnAmount = BigInt(realAmount);

	const isEnoughAllowance = await ensureEnoughAllowance(
		manager,
		bnAmount,
		signer,
		confirm
	);

	if (!isEnoughAllowance) {
		process.exit(0);
	}

	return bnAmount;
}
