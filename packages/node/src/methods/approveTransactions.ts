import { TREASURY } from '@/utils/constants';
import { getSafe } from '@/utils/safe';

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
