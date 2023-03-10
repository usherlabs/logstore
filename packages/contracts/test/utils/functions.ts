import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import Wallet from 'ethereumjs-wallet';
import { BigNumber, ContractTransaction, ethers } from 'ethers';
import { ethers as hEthers, upgrades } from 'hardhat';

import { NODE_MANAGER } from '../utils/constants';
import ERC20 from './abi/ERC20.json';

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

// pass in amount and it returns the big number representation of amount*10e18
export function getDecimalBN(amount: number) {
	if (amount < 0) throw 'amount < 0';
	return BigNumber.from(`${amount}${'0'.repeat(18)}`);
}

export const getERC20Token = async (signer: SignerWithAddress) =>
	new ethers.Contract(NODE_MANAGER.STAKE_TOKEN, ERC20, signer);

export async function ApproveFundsForContract(
	contractAddress: string,
	amount: BigNumber,
	signer: SignerWithAddress
) {
	const tokenContract = await getERC20Token(signer);
	await tokenContract.functions.approve(contractAddress, amount);
	const confirmation = await tokenContract.functions.allowance(
		signer.address,
		contractAddress
	);
	return confirmation;
}
