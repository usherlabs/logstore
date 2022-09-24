import { VOTE } from '@kyve/core/dist/src/utils/constants';

import type { Node } from '../node';

/**
 * Here we vote on whether to submit the relevant transactions
 *
 * In the future, we'll add more validation of the transactions proposed.
 * We'll also need a transaction retry mechanism... -- ie. The network has it's own built in pipeline to retry transactions that were poorly/invalidly submitted by a Node.
 * -- ie in the case bundle is successful but transactions were not.
 */

export async function voteTransactions(
	this: Node,
	id: string,
	// instructions: SubmitInstruction[]
	bundleVote: number
): Promise<void> {
	// Fetch all transactions from the Bundle Tags
	const metadata = await this.storageProvider.retrieveBundleMetadata(id);
	const txHashes = metadata
		.filter(([k]) => k.startsWith('ETL-Network-Tx-'))
		.map(([, v]) => v);

	// Approve or dismiss based on bundleVote
	if (bundleVote === VOTE.VALID) {
		this.approveTransactions(txHashes);
	}
}
