import { task } from 'hardhat/config';

import { getTaskConfig } from './utils';

task('admin:whitelist-lsan', 'Admin: Whitelist wallet to transfer LSAN tokens')
	.addPositionalParam('from')
	.addPositionalParam('to')
	.setAction(async (taskArgs: { from: string; to: string }, hre) => {
		const { tokenContract } = await getTaskConfig(hre);

		const { from, to } = taskArgs;

		const tx = await tokenContract.addWhitelist(from, to);
		console.log(`Whitelisting wallet ${from} to transfer LSAN to ${to}`);
		const receipt = await tx.wait();
		console.log(`Tx: ${receipt.transactionHash}`);
	});
