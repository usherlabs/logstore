import { LSAN__factory } from '@logsn/contracts';
import { Signer } from 'ethers';

import { getManagerContract } from './getManager';
import { Manager } from './types';

export type allowanceConfirmFn = (
	currentAllowance: bigint,
	requiredAllowance: bigint
) => Promise<boolean>;

export const ensureEnoughAllowance = async (
	manager: Exclude<Manager, Manager.ReportManager>,
	amount: bigint,
	signer: Signer,
	confirm?: allowanceConfirmFn
) => {
	const mangerContract = await getManagerContract(signer, manager);
	// @ts-ignore -- manager excludes ReportManager
	const stakeTokenAddress = await mangerContract.stakeTokenAddress();
	const stakeToken = LSAN__factory.connect(stakeTokenAddress, signer);

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
