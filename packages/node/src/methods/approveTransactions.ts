// import { sleep } from '@kyve/core/dist/src/utils';
import ethers, { BigNumber } from 'ethers';
import { SafeTransactionDataPartial } from '@gnosis.pm/safe-core-sdk-types';

import { TREASURY } from '@/utils/constants';
import { getSafe } from '@/utils/safe';
import { ethereumChainId } from '';

import type { Node } from '../node';

export async function approveTransactions(this: Node, txHashes: string[]) {
	const safeSdk = await getSafe(
		this.connections.signer,
		TREASURY[this.connections.eth.chainId]
	);

	for (let i = 0; i < txHashes.length; i += 1) {
		const txHash = txHashes[i];

		const approveTxResponse = await safeSdk.approveTransactionHash(txHash);
		await approveTxResponse.transactionResponse?.wait();
	}
}
