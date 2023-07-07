import { task } from 'hardhat/config';

import { getTaskConfig } from './utils';

task('admin:mint', 'Admin: Mint Tokens to Address')
	.addPositionalParam('to')
	.addPositionalParam('amount')
	.setAction(async (taskArgs: { to: string; amount: number }, hre) => {
		const { tokenContract } = await getTaskConfig(hre);

		const { to, amount } = taskArgs;

		const tx = await tokenContract.mintTokens(to, amount);
		console.log(`Submitted minting ${amount} LSAN tokens to ${to}`);
		const receipt = await tx.wait();
		console.log(`Tx: ${receipt.transactionHash}`);
	});
