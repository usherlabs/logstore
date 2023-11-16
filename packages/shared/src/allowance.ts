import { LSAN__factory } from '@logsn/contracts';
import { type ContractTransaction, type Overrides, Signer } from 'ethers';

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
): Promise<boolean> => {
	return requestAllowanceIfNeeded(manager, amount, signer, confirm)
		.then((tx) => {
			if (tx) {
				return tx.wait().then((receipt) => {
					if (receipt.status === 0) {
						throw new Error('Transaction failed');
					}
					return true;
				});
			} else {
				return true;
			}
		})
		.catch((e) => {
			console.error(e);
			return false;
		});
};

/**
 * Differently from the method above, it instead returns the TX.
 * Created not to break existing usages
 */
export const requestAllowanceIfNeeded = async (
	manager: Exclude<Manager, Manager.ReportManager>,
	amount: bigint,
	signer: Signer,
	confirm?: allowanceConfirmFn,
	overrides?: Overrides
): Promise<null | ContractTransaction> => {
	const mangerContract = await getManagerContract(signer, manager);
	// @ts-expect-error -- manager excludes ReportManager
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
			return stakeToken.approve(mangerContract.address, amount, overrides);
		} else {
			throw new Error('User didn’t confirm allowance');
		}
	}

	return null;
};
