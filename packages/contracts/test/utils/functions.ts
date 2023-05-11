import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import Wallet from 'ethereumjs-wallet';
import { BigNumber, Contract, ContractTransaction, ethers } from 'ethers';
import { ethers as hEthers, upgrades } from 'hardhat';

import { getReportBlockBuffer } from '../../utils/functions';
import ERC20 from './abi/ERC20.json';
import {
	// CONSUMER_ADDRESS,
	CONSUMER_INDEX,
	FAKE_STREAMR_REGISTRY,
	NODE_MANAGER,
	SAMPLE_STREAM_ID,
	SAMPLE_WSS_URL,
} from './constants';
import { ReportData } from './types';

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
	await mintFundsToAddresses();
	const nodeManager = await hEthers.getContractFactory(
		'LogStoreNodeManager',
		adminAddress
	);

	const nodeManagerContract = await upgrades.deployProxy(nodeManager, [
		adminAddress.address,
		true,
		NODE_MANAGER.STAKE_TOKEN,
		NODE_MANAGER.STAKE_REQUIRED_AMOUNT,
		FAKE_STREAMR_REGISTRY,
		NODE_MANAGER.INITIAL_NODES,
		NODE_MANAGER.INITIAL_METADATA,
	]);

	return nodeManagerContract;
}

export async function loadQueryManager(
	signer: SignerWithAddress,
	adminAddress: undefined | string = undefined
) {
	await mintFundsToAddresses();
	const queryManager = await hEthers.getContractFactory(
		'LogStoreQueryManager',
		signer
	);
	const queryManagerContract = await upgrades.deployProxy(queryManager, [
		adminAddress || signer.address,
		NODE_MANAGER.STAKE_TOKEN,
	]);
	// approve all accounts so all can stake
	const nodes = await hEthers.getSigners();
	await Promise.all(
		nodes.map(async (node) =>
			ApproveFundsForContract(
				queryManagerContract.address,
				getDecimalBN(100),
				node
			)
		)
	);
	return queryManagerContract;
}

export async function mintFundsToAddresses() {
	const signers = await hEthers.getSigners();
	const token = await getERC20Token(signers[0]);
	const addresses = await Promise.all(
		signers.map(async ({ address }) => {
			await token.functions.mint(address, getDecimalBN(1000));
			return address;
		})
	);
	return addresses;
}

export async function loadStoreManager(
	signer: SignerWithAddress,
	adminAddress: undefined | string = undefined
) {
	await mintFundsToAddresses();
	const queryManager = await hEthers.getContractFactory(
		'LogStoreManager',
		signer
	);
	const storeManagerContract = await upgrades.deployProxy(queryManager, [
		adminAddress || signer.address,
		NODE_MANAGER.STAKE_TOKEN,
		FAKE_STREAMR_REGISTRY,
	]);
	// approve all accounts so all can stake
	const nodes = await hEthers.getSigners();
	await Promise.all(
		nodes.map(async (node) =>
			ApproveFundsForContract(
				storeManagerContract.address,
				getDecimalBN(100),
				node
			)
		)
	);
	return storeManagerContract;
}

export async function setupNodeManager(
	adminAddress: SignerWithAddress,
	nodes: SignerWithAddress[]
) {
	const approveAmount = getDecimalBN(1000);
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
	await mintFundsToAddresses();
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

	const reportBlockBuffer = await getReportBlockBuffer();
	const reportManagerContract = await upgrades.deployProxy(
		reportManager,
		[nodeManagerContract.address, reportBlockBuffer],
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
}): Promise<ReportData> {
	const nodeAddress = signer.address;
	const signers = await hEthers.getSigners();
	const consumer = signers[CONSUMER_INDEX].address.toLowerCase();
	const reportdata: ReportData = {
		bundleId,
		blockheight: blockheight,
		streams: [SAMPLE_STREAM_ID],
		writeCaptureAmounts: [10000],
		writeBytes: [5],
		readConsumerAddress: [consumer],
		readCaptureAmounts: [20000],
		readBytes: [6],
		nodes: [nodeAddress],
		nodeChanges: [30000],
		delegates: [nodeAddress],
		delegateNodes: [[nodeAddress]],
		delegateNodeChanges: [[40000]],
		treasurySupplyChange: 50000,
		address: [nodeAddress],
	};

	// ---- Include signatures in the report
	const { reportHash } = await generateReportHash({ signer, blockheight });
	const signature = await signer.signMessage(ethers.utils.arrayify(reportHash));
	reportdata['signatures'] = [signature];

	return reportdata;
}

// @todo make the addresses variable too so it will pass on other people's system
export async function generateReportHash({
	signer,
	blockheight,
}: {
	signer: SignerWithAddress;
	blockheight: number;
}) {
	// so any change in values there should be reflected here
	const nodeAddress = signer.address;
	const signers = await hEthers.getSigners();
	const consumer = signers[CONSUMER_INDEX].address.toLowerCase();

	const reportJson = {
		id: '75',
		height: `${blockheight}`,
		treasury: '50000',
		streams: [{ id: SAMPLE_STREAM_ID, capture: 10000, bytes: 5 }],
		consumers: [
			{
				id: consumer.toLowerCase(),
				capture: 20000,
				bytes: 6,
			},
		],
		nodes: { [nodeAddress.toLowerCase()]: 30000 },
		delegates: {
			[nodeAddress.toLowerCase()]: {
				[nodeAddress.toLowerCase()]: 40000,
			},
		},
	};
	const reportHash = ethers.utils.solidityKeccak256(
		['string'],
		[JSON.stringify(reportJson)]
	);
	return { reportHash, data: reportJson };
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

export const range = (count: number) => [...new Array(count).keys()];
