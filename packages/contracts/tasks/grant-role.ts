import { task } from 'hardhat/config';

import { getTaskConfig } from './utils';

task(
	'admin:grant-role',
	'Admin: Grant Role of Wallet Address to Smart Contract Address'
)
	.addPositionalParam('role', 'The role to grant')
	.addPositionalParam('wallet', 'Wallet address to grant role to')
	.addPositionalParam(
		'contract',
		'Smart Contract address where role is granted'
	)
	.setAction(
		async (
			taskArgs: { role: string; wallet: string; contract: string },
			hre
		) => {
			const { tokenContract, nodeManagerContract } = await getTaskConfig(hre);

			const { role, wallet, contract } = taskArgs;
			let roleNum: number;
			switch (role) {
				case 'USER': {
					roleNum = 0;
					break;
				}
				case 'SUPER_USER': {
					roleNum = 1;
					break;
				}
				case 'DEV': {
					roleNum = 2;
					break;
				}
				case 'ADMIN': {
					roleNum = 3;
					break;
				}
				default: {
					throw new Error('Invalid role');
				}
			}

			let tx;
			if (contract === nodeManagerContract.address) {
				tx = await nodeManagerContract.grantRole(roleNum, wallet);
				console.log(
					`Granting role of ${role}:${roleNum} to ${wallet} on LogStoreNodeManager`
				);
			} else if (contract === tokenContract.address) {
				tx = await tokenContract.grantRole(roleNum, wallet);
				console.log(`Granting role of ${role}:${roleNum} to ${wallet} on LSAN`);
			} else {
				throw new Error('Invalid Smart Contract Address');
			}
			const receipt = await tx.wait();
			console.log(`Tx: ${receipt.transactionHash}`);
		}
	);
