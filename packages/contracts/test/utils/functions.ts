import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import Wallet from 'ethereumjs-wallet';
import { BigNumber, Contract, ContractTransaction, ethers } from 'ethers';
import { ethers as hEthers, upgrades } from 'hardhat';

import {
	CONSUMER_ADDRESS,
	NODE_MANAGER,
	SAMPLE_WSS_URL,
} from '../utils/constants';
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

export async function setupNodeManager(
	adminAddress: SignerWithAddress,
	nodes: SignerWithAddress[]
) {
	const approveAmount = getDecimalBN(10);
	const nodeManagerContract = await loadNodeManager(adminAddress);

	await Promise.all(
		nodes.map(async (node: SignerWithAddress) => {
			// whitelist node
			await nodeManagerContract.functions.whitelistApproveNode(node.address);
			// approve node for stake
			await ApproveFundsForContract(
				nodeManagerContract.address,
				approveAmount,
				node
			);
			// have node join the network
			await nodeManagerContract
				.connect(node)
				.functions.join(getDecimalBN(10), SAMPLE_WSS_URL);
			return node;
		})
	);

	return nodeManagerContract;
}

export async function loadReportManager(
	adminAddress: SignerWithAddress,
	nodeManagerContract: Contract
) {
	// deploy libs
	const Lib = await hEthers.getContractFactory('VerifySignature');
	const lib = await Lib.deploy();
	await lib.deployed();
	// deploy contract
	const reportManager = await hEthers.getContractFactory(
		'LogStoreReportManager',
		{
			signer: adminAddress,
			libraries: {
				VerifySignature: lib.address,
			},
		}
	);

	const reportManagerContract = await upgrades.deployProxy(
		reportManager,
		[nodeManagerContract.address],
		{ unsafeAllowLinkedLibraries: true }
	);
	return reportManagerContract;
}

export async function generateReportData({
	blockheight,
	signer,
	bundleId = `${generateRandomNumber(100)}`,
}: {
	blockheight: number;
	signer: SignerWithAddress;
	bundleId: string;
}) {
	const nodeAddress = signer.address;
	// this value was emmited from the contract for a give payload and then copied here
	// if any of these values are changed then the 'reportHash' value would need to be recomputed
	const reportHash =
		'0xa7bdc0e630d1cf995eb3746d3fc858e9040f177ccc032538384962733e1d8e8a';
	const signature = await signer.signMessage(ethers.utils.arrayify(reportHash));
	// return the same value everytime so the signature calculates checks out
	return {
		bundleId,
		blockheight,
		fee: getDecimalBN(10),
		streams: ['xand6r.eth/demos/twitter/sample'],
		nodesPerStream: [[nodeAddress]],
		bytesObservedPerNode: [[10]],
		bytesMissedPerNode: [[1]],
		bytesQueriedPerNode: [[5]],
		consumerAddresses: [[CONSUMER_ADDRESS]],
		bytesQueriedPerConsumer: [[5]],
		address: [nodeAddress],
		signatures: [signature],
	};
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

export function generateRandomNumber(maxNumber: number) {
	return Math.floor(Math.random() * maxNumber);
}
export const getTimeStamp = async () =>
	(await hEthers.provider.getBlock('latest')).timestamp;

export const getLatestBlockNumber = async () =>
	(await hEthers.provider.getBlock('latest')).number;
