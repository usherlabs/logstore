import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { task } from 'hardhat/config';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

import type { LogStore } from '../../types/LogStore';
import type { LogStore__factory } from '../../types/factories/LogStore__factory';

task('deploy:LogStore').setAction(
	async ({ ethers }: HardhatRuntimeEnvironment) => {
		const signers: SignerWithAddress[] = await ethers.getSigners();
		const logstoreFactory: LogStore__factory = <LogStore__factory>(
			await ethers.getContractFactory('LogStore')
		);
		const logstore: LogStore = <LogStore>(
			await logstoreFactory.connect(signers[0]).deploy()
		);
		await logstore.deployed();
		console.log('logstore deployed to: ', logstore.address);
	}
);
