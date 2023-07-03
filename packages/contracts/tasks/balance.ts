import { task } from 'hardhat/config';

import { getTaskConfig } from './utils';

task('admin:balance', "Admin: Get Wallet Address's balance of LSAN")
	.addPositionalParam('address')
	.setAction(async (taskArgs: { address: string }, hre) => {
		const { tokenContract } = await getTaskConfig(hre);

		const { address } = taskArgs;
		try {
			const balance = await tokenContract.balanceOf(address);
			console.log();
			console.log(`LSAN owned by ${address}: ${balance}`);
		} catch (e) {
			console.error(e);
		}
	});
