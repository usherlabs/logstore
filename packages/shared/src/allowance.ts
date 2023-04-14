import { ERC20__factory } from '@concertodao/logstore-contracts';
import { Signer } from 'ethers';

import { getManagerContract } from './getManager';
import { Manager } from './types';

export type allowanceConfirmFn = (
	currentAllowance: bigint,
	requiredAllowance: bigint
) => Promise<boolean>;

export const ensureEnoughAllowance = async (
	manager: Manager,
	amount: bigint,
	signer: Signer,
	confirm?: allowanceConfirmFn
) => {
	const mangerContract = await getManagerContract(signer, manager);

	const stakeTokenAddress = await mangerContract.stakeTokenAddress();
	const stakeToken = ERC20__factory.connect(stakeTokenAddress, signer);

	const currentAllowance = (
		await stakeToken.allowance(
			await signer.getAddress(),
			mangerContract.address
		)
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
