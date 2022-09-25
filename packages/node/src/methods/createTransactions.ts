// import { sleep } from '@kyve/core/dist/src/utils';
import ethers, { BigNumber } from 'ethers';
import { SafeTransactionDataPartial } from '@gnosis.pm/safe-core-sdk-types';

import { TREASURY } from '@/utils/constants';
import { SubmitInstruction } from '@/types/index';
import { getSafe } from '@/utils/safe';

import type { Node } from '../node';

export async function createTransactions(
	this: Node,
	instructions: SubmitInstruction[]
): Promise<string[]> {
	const safeSdk = await getSafe(
		this.connections.signer,
		TREASURY[this.connections.eth.chainId]
	);

	const txDataItems = [];
	instructions.forEach((instruction) => {
		instruction.ethereum.forEach((txRequest) => {
			const methodSig = txRequest.method.split(' ').join('');
			const methodSighash = ethers.utils.id(methodSig);
			const methodSigBytes = ethers.utils.arrayify(methodSighash);
			const funcSelBytes = methodSigBytes.slice(0, 4);
			const funcSelector = ethers.utils.hexlify(funcSelBytes);

			const paramsParts = [];
			txRequest.params.forEach((param) => {
				let part = param;
				if (typeof part === 'boolean') {
					part = part ? 1 : 0;
				}
				if (!ethers.utils.isHexString(part)) {
					part = ethers.utils.hexlify(part);
				}
				part = part as string;
				if (part.length < 66) {
					part = ethers.utils.hexZeroPad(part, 66 - part.length);
					return;
				}
				paramsParts.push(part);
			});

			const data = funcSelector + paramsParts.join('');

			const safeTransactionData: SafeTransactionDataPartial = {
				to: txRequest.contract,
				value: ethers.utils.formatEther(BigNumber.from('0')),
				data,
			};

			txDataItems.push(safeTransactionData);
		});
	});

	const hashes = [];
	for (let i = 0; i < txDataItems.length; i += 1) {
		const txData = txDataItems[i];

		const safeTransaction = await safeSdk.createTransaction({
			safeTransactionData: txData,
		});
		// const signedSafeTransaction = await safeSdk.signTransaction(
		// 	safeTransaction
		// );
		const txHash = await safeSdk.getTransactionHash(safeTransaction);
		hashes.push(txHash);
	}

	return hashes;
}
