import { task } from 'hardhat/config';

import { getTaskConfig } from './utils';

task(
	'admin:min-stake-amount',
	'Admin: Get minimum stake amount for Node Manager'
).setAction(async (taskArgs: { to: string; amount: number }, hre) => {
	const { nodeManagerContract } = await getTaskConfig(hre);

	const minStakeAmount = await nodeManagerContract.stakeRequiredAmount();
	console.log(
		`Minimum Stake Amount required by Broker Nodes is ${minStakeAmount.toString()}`
	);
});
