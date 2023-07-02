import { task } from 'hardhat/config';

import { LSAN__factory } from '../';
import ContractAddresses from '../address.json';

task('admin:mint', 'Admin: Mint Tokens to Address')
	.addPositionalParam('to')
	.addPositionalParam('amount')
	.setAction(async (taskArgs: { to: string; amount: number }, hre) => {
		const chainId = hre.network.config.chainId;
		console.log('Chain Id:', chainId);

		const { to, amount } = taskArgs;

		const [signer] = await hre.ethers.getSigners();
		const chainIdIndex = `${chainId}` as keyof typeof ContractAddresses;
		const { tokenManagerAddress: lsanTokenAddress } = ContractAddresses[
			chainIdIndex
		] as any;
		console.log('LSAN Token Address:', lsanTokenAddress);
		const tokenContract = LSAN__factory.connect(lsanTokenAddress, signer);

		const tx = await tokenContract.mintTokens(to, amount);
		console.log(`Submitted minting ${amount} LSAN tokens to ${to}`);
		const receipt = await tx.wait();
		console.log(`Tx: ${receipt.transactionHash}`);
	});
