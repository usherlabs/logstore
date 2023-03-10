import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import Wallet from 'ethereumjs-wallet';
import { ContractTransaction } from 'ethers';
import { ethers as hEthers, upgrades } from 'hardhat';

import { NODE_MANAGER } from '../utils/constants';

export const generateWallet = () => Wallet.generate().getAddressString();

export async function fetchEventArgsFromTx(
	tx: ContractTransaction,
	eventName: string
) {
	const receipt = await tx.wait();
	const foundEvent = receipt.events?.find((x) => x.event === eventName);
	return foundEvent?.args;
}

export async function loadNodeManager(adminAddress: SignerWithAddress) {
	const nodeManager = await hEthers.getContractFactory(
		'LogStoreNodeManager',
		adminAddress
	);

	const nodeManagerContract = await upgrades.deployProxy(nodeManager, [
		adminAddress.address,
		true,
		NODE_MANAGER.STAKE_TOKEN,
		NODE_MANAGER.STAKE_REQUIRED_AMOUNT,
		NODE_MANAGER.WRITE_FEE_POINTS,
		NODE_MANAGER.TREASURY_FEE_POINTS,
		NODE_MANAGER.READ_FEE,
		NODE_MANAGER.INITIAL_NODES,
		NODE_MANAGER.INITIAL_METADATA,
	]);

	return nodeManagerContract;
}
