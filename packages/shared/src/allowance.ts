import { ERC20__factory } from '@concertodao/logstore-contracts';
import { ethers } from 'ethers';

import { getManagerContract } from './getManager';
import { Manager } from './types';

export type allowanceConfirmFn = (
	currentAllowance: bigint,
	requiredAllowance: bigint
) => Promise<boolean>;

export const ensureEnoughAllowance = async (
	manager: Manager,
	amount: bigint,
	wallet: ethers.Wallet,
	confirm?: allowanceConfirmFn
) => {
	const mangerContract = await getManagerContract(wallet, manager);

	const stakeTokenAddress = await mangerContract.stakeTokenAddress();
	const stakeToken = ERC20__factory.connect(stakeTokenAddress, wallet);

	const currentAllowance = (
		await stakeToken.allowance(wallet.address, mangerContract.address)
	).toBigInt();

	if (currentAllowance < amount) {
		const requiredAllowance = amount - currentAllowance;
		const confirmed =
			!confirm || (await confirm(currentAllowance, requiredAllowance));

		if (confirmed) {
			await (await stakeToken.approve(mangerContract.address, amount)).wait();
			return true;
		} else {
			return false;
		}
	}

	return true;
};
