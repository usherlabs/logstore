import { task } from 'hardhat/config';

import { getTaskConfig } from './utils';

task('admin:whitelist-brokers', 'Admin: Whitelist Broker Node Addresses')
	.addPositionalParam('from', 'Comma-seperated list of Broker addresses')
	.setAction(async (taskArgs: { from: string }, hre) => {
		const { tokenContract, nodeManagerContract } = await getTaskConfig(hre);

		const { from } = taskArgs;
		const brokerAddresses = from.split(',');

		const tx = await tokenContract.massAddWhitelist(
			brokerAddresses,
			brokerAddresses.map(() => nodeManagerContract.address)
		);
		brokerAddresses.forEach((a) => {
			console.log(
				`Whitelisting wallet ${a} to transfer LSAN to NodeManager Contract (${nodeManagerContract.address})`
			);
		});
		const receipt = await tx.wait();
		console.log(`Tx: ${receipt.transactionHash}`);
	});
