import { task } from 'hardhat/config';

import { getTaskConfig } from './utils';

const ROLES_NAMES: { [key: number]: string } = {
	0: 'USER',
	1: 'SUPER_USER',
	2: 'DEV',
	3: 'ADMIN',
};

task(
	'admin:get-role',
	'Admin: Get granted Role of Wallet Address to Smart Contract Address'
)
	.addPositionalParam('wallet', 'Wallet Address to get the role')
	.addPositionalParam(
		'contract',
		'Smart Contract Address where the role is granted'
	)
	.setAction(async (taskArgs: { wallet: string; contract: string }, hre) => {
		const { tokenContract, nodeManagerContract } = await getTaskConfig(hre);
		const { wallet, contract } = taskArgs;

		if (contract === nodeManagerContract.address) {
			const roleNum = await nodeManagerContract.roles(wallet);
			const roleName = ROLES_NAMES[roleNum];
			console.log(
				`The Granted role is ${roleName}:${roleNum} to ${wallet} on LogStoreNodeManager`
			);
		} else if (contract === tokenContract.address) {
			const roleNum = await tokenContract.roles(wallet);
			const roleName = ROLES_NAMES[roleNum];
			console.log(
				`The Granted role is ${roleName}:${roleNum} to ${wallet} on LSAN`
			);
		} else {
			throw new Error('Invalid Smart Contract Address');
		}
	});
