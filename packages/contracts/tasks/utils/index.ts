import { HardhatRuntimeEnvironment } from 'hardhat/types';

import ContractAddresses from '../../address.json';

export const getTaskConfig = async (hre: HardhatRuntimeEnvironment) => {
	const { LSAN__factory } = await import('../..');
	const chainId = hre.network.config.chainId;
	console.log('Chain Id:', chainId);
	const chainIdIndex = `${chainId}` as keyof typeof ContractAddresses;
	const [signer] = await hre.ethers.getSigners();
	const { tokenManagerAddress: lsanTokenAddress } = ContractAddresses[
		chainIdIndex
	] as any;
	console.log('LSAN Token Address:', lsanTokenAddress);
	const tokenContract = LSAN__factory.connect(lsanTokenAddress, signer);

	return {
		chainId,
		signer,
		LSAN__factory,
		tokenContract,
	};
};
