import { task } from 'hardhat/config';

import { getTaskConfig } from './utils';

task('admin:create-stream', 'Admin: Create a Stream managed by NodeManager')
	.addPositionalParam('key')
	.addPositionalParam('path')
	.addPositionalParam('metadata')
	.setAction(
		async (taskArgs: { key: string; path: string; metadata: string }, hre) => {
			const { nodeManagerContract } = await getTaskConfig(hre);

			const { key, path, metadata } = taskArgs;

			console.log(
				`Creating Stream key:${key} path:${path} metadata:${metadata}`
			);
			const tx = await nodeManagerContract.createStream(key, path, metadata);
			const receipt = await tx.wait();
			console.log(`Tx: ${receipt.transactionHash}`);
		}
	);
