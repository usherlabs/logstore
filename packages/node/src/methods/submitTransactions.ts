// import { sleep } from '@kyve/core/dist/src/utils';
import ethers, { BigNumber } from 'ethers';
import EthersAdapter from '@gnosis.pm/safe-ethers-lib';
import { SafeTransactionDataPartial } from '@gnosis.pm/safe-core-sdk-types';
import Safe from '@gnosis.pm/safe-core-sdk';
import { randomString } from '@stablelib/random';

import { MULTISIG_GOERLI } from '@/utils/constants';
import { SubmitInstruction } from '@/types/index';

import type { Node } from '../node';

export async function submitTransactions(
	this: Node,
	id: string,
	instructions: SubmitInstruction[]
): Promise<void> {
	// Setup the EthersAdapter
	const adapter = new EthersAdapter({
		ethers,
		signer: this.connections.signer,
	});
	const safeSdk: Safe = await Safe.create({
		ethAdapter: adapter,
		safeAddress: MULTISIG_GOERLI,
	});

	const txDataItems = [];
	instructions.forEach((instruction) => {
		instruction.polygon.forEach((txRequest) => {
			const methodSig = ethers.utils.keccak256(
				ethers.utils.toUtf8Bytes(txRequest.method)
			);
			const methodSigBytes = ethers.utils.arrayify(methodSig);
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

	for (let i = 0; i < txDataItems.length; i += 1) {
		const txData = txDataItems[i];

		const safeTransaction = await safeSdk.createTransaction({
			safeTransactionData: txData,
		});
		// const signedSafeTransaction = await safeSdk.signTransaction(
		// 	safeTransaction
		// );
		const txHash = await safeSdk.getTransactionHash(safeTransaction);
		const approveTxResponse = await safeSdk.approveTransactionHash(txHash, {
			nonce: [randomString(16), id].join('_'),
		});
		await approveTxResponse.transactionResponse?.wait();
	}
}
