import {
	IReportV1,
	ProofOfReport,
	ReportContractParams,
	ReportSerializerVersions,
	SystemReport,
} from '@logsn/protocol';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import Wallet from 'ethereumjs-wallet';
import { BigNumber, Contract, ContractTransaction, ethers } from 'ethers';
import { ethers as hEthers, upgrades } from 'hardhat';

import ERC20 from './abi/ERC20.json';
import {
	// CONSUMER_ADDRESS,
	CONSUMER_INDEX,
	FAKE_STREAMR_REGISTRY,
	NODE_MANAGER,
	REPORT_TIME_BUFFER,
	SAMPLE_STREAM_ID,
	SAMPLE_WSS_URL,
} from './constants';

type ContractReportPayload = [
	...ReportContractParams,
	string[],
	number[],
	string[]
];
type ReportData = {
	report: IReportV1;
	systemReport: SystemReport;
	reportContractParams: ReportContractParams;
};

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
	nodeManagerContract: Contract,
	{ reportTimeBuffer = REPORT_TIME_BUFFER, withTime = 0 }
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

	const reportManagerContract = await upgrades.deployProxy(
		reportManager,
		[nodeManagerContract.address, reportTimeBuffer, withTime],
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
	const report: IReportV1 = {
		s: false,
		v: ReportSerializerVersions.V1,
		id: bundleId,
		height: blockheight,
		streams: [
			{ id: SAMPLE_STREAM_ID, capture: BigNumber.from(10000), bytes: 5 },
		],
		consumers: [
			{
				id: consumer,
				capture: BigNumber.from(20000),
				bytes: 6,
			},
		],
		nodes: {
			[nodeAddress]: BigNumber.from(30000),
		},
		delegates: {
			[nodeAddress]: {
				[nodeAddress]: BigNumber.from(40000),
			},
		},
		treasury: BigNumber.from(50000),
	};
	const systemReport = new SystemReport(report);
	const reportContractParams: ReportContractParams = systemReport.toContract();

	return {
		report,
		systemReport,
		reportContractParams,
	};
}

export async function generateContractReportPayload(
	signers: SignerWithAddress[],
	systemReport: SystemReport
) {
	const proofs: ProofOfReport[] = [];
	const payloadAddresses = [];
	const payloadTimestamps = [];
	const payloadSignatures = [];
	for (let i = 0; i < signers.length; i++) {
		// // Remove buffer from the current time when Proof is generated.
		const proof = await systemReport.toProof(
			signers[i]
			// Date.now() - REPORT_TIME_BUFFER * 1000
		);
		proofs.push(proof);
		payloadAddresses.push(proof.address);
		payloadTimestamps.push(proof.timestamp);
		payloadSignatures.push(proof.signature);
	}

	const payload: ContractReportPayload = [
		...systemReport.toContract(),
		payloadAddresses,
		payloadTimestamps,
		payloadSignatures,
	];

	return { payload, proofs };
}

export const proofsToMean = (proofs: ProofOfReport[]) => {
	const proofTimestamps = proofs.map((p) => p.timestamp);
	let meanTimestamp = proofTimestamps.reduce<number>((sum, curr) => {
		sum += curr;
		return sum;
	}, 0);
	meanTimestamp = meanTimestamp / proofTimestamps.length;
	return meanTimestamp;
};

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

export const getTimeStampByBlock = async (block: number) =>
	(await hEthers.provider.getBlock(block)).timestamp;

export const getLatestBlockNumber = async () =>
	(await hEthers.provider.getBlock('latest')).number;

export const range = (count: number) => [...new Array(count).keys()];

export const sleep = (timeout: number) =>
	new Promise((resolve) => setTimeout(resolve, timeout));
