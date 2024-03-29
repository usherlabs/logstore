import { LSAN__factory } from '@logsn/contracts';
import { Overrides, Signer } from 'ethers';
import { Logger } from 'tslog';

import { allowanceConfirmFn, ensureEnoughAllowance } from './allowance';
import { convertFromUsd } from './convertFromUsd';
import { getManagerContract } from './getManager';
import { minLogLevel } from './logger';
import { Manager } from './types';

export const logger = new Logger({ minLevel: minLogLevel });

export async function prepareStakeForNodeManager(
	signer: Signer,
	amount: bigint | number,
	isUsd?: boolean,
	confirm?: allowanceConfirmFn,
	ensureAllowance: boolean = true,
	overrides?: Overrides
) {
	return prepareStake(
		Manager.NodeManager,
		signer,
		amount,
		isUsd,
		confirm,
		ensureAllowance,
		overrides
	);
}

export async function prepareStakeForStoreManager(
	signer: Signer,
	amount: bigint | number,
	isUsd?: boolean,
	confirm?: allowanceConfirmFn,
	ensureAllowance: boolean = true,
	overrides?: Overrides
) {
	return prepareStake(
		Manager.StoreManager,
		signer,
		amount,
		isUsd,
		confirm,
		ensureAllowance,
		overrides
	);
}

export async function prepareStakeForQueryManager(
	signer: Signer,
	amount: bigint | number,
	isUsd?: boolean,
	confirm?: allowanceConfirmFn,
	ensureAllowance: boolean = true,
	overrides?: Overrides
) {
	return prepareStake(
		Manager.QueryManager,
		signer,
		amount,
		isUsd,
		confirm,
		ensureAllowance,
		overrides
	);
}

async function prepareStake(
	manager: Exclude<Manager, Manager.ReportManager>,
	signer: Signer,
	amount: bigint | number,
	isUsd?: boolean,
	confirm?: allowanceConfirmFn,
	ensureAllowance: boolean = true,
	overrides?: Overrides
) {
	if (amount <= 0) {
		throw new Error('Amount must be > 0');
	}

	const managerContract = await getManagerContract(signer, manager);
	// @ts-ignore -- manager excludes ReportManager
	const stakeTokenAddress: string = await managerContract.stakeTokenAddress();
	logger.debug('Stake Token Address: ', stakeTokenAddress);

	const stakeTokenContract = LSAN__factory.connect(stakeTokenAddress, signer);
	const stakeTokenSymbol = await stakeTokenContract.symbol();
	logger.debug('Stake Token Symbol: ', stakeTokenSymbol);

	logger.debug(`${manager} Contract Address: `, managerContract.address);

	let realAmount = amount;
	if (isUsd) {
		realAmount = await convertFromUsd(
			stakeTokenAddress,
			amount as number,
			signer,
			Date.now()
		);
	}

	const bnAmount = BigInt(realAmount);

	if (ensureAllowance) {
		const isEnoughAllowance = await ensureEnoughAllowance(
			manager,
			bnAmount,
			signer,
			confirm,
			overrides,
		);

		if (!isEnoughAllowance) {
			throw new Error(
				'Not enough of an allowance to authorise a token transfer'
			);
		}
	}

	return bnAmount;
}
