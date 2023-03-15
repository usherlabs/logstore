import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber, Contract } from 'ethers';
import { ethers } from 'hardhat';

import {
	CUSTOM_EXCEPTIONS,
	NODE_MANAGER,
	REPORT_MANAGER_EVENTS,
	SAMPLE_STREAM_ID,
	SAMPLE_WSS_URL,
} from './utils/constants';
import {
	ApproveFundsForContract,
	fetchEventArgsFromTx,
	generateReportData,
	generateReportHash,
	getDecimalBN,
	getERC20Token,
	getLatestBlockNumber,
	loadQueryManager,
	loadReportManager,
	loadStoreManager,
	setupNodeManager,
} from './utils/functions';

describe('ReportManager', async function () {
	let adminSigner: SignerWithAddress;
	let otherSigners: SignerWithAddress[];
	let activeNodes: SignerWithAddress[];
	let reportManagerContract: Contract;
	let nodeManagerContract: Contract;
	let token: Contract;

	beforeEach(async () => {
		[adminSigner, ...otherSigners] = await ethers.getSigners();
		activeNodes = otherSigners.slice(0, 2);
		nodeManagerContract = await setupNodeManager(adminSigner, activeNodes);
		reportManagerContract = await loadReportManager(
			adminSigner,
			nodeManagerContract
		);
		token = await getERC20Token(adminSigner);
	});

	it('ReportManager ---- un-staked Node cannot submit report', async function () {
		// use the 15th because node 0-10 have been staked and we need an unstaked node
		const sampleNode = otherSigners[15];

		const blockNumber = await getLatestBlockNumber();
		const reportData = await generateReportData({
			bundleId: '75',
			blockheight: +blockNumber - 10,
			signer: sampleNode,
		});

		const responseTx = reportManagerContract
			.connect(sampleNode)
			.functions.report(...Object.values(reportData));

		await expect(responseTx).to.be.revertedWith(
			CUSTOM_EXCEPTIONS.STAKE_REQUIRED
		);
	});

	it('ReportManager ---- Staked Node can only submit report when quorum is met', async function () {
		const sampleNode = activeNodes[0];
		const blockNumber = await getLatestBlockNumber();
		const reportData = await generateReportData({
			bundleId: '75',
			blockheight: +blockNumber - 10,
			signer: sampleNode,
		});

		// add more nodes to the network, such that requiredNodes > 1 and joinedNodes > 3
		await Promise.all(
			otherSigners.map(async (signer) => {
				await nodeManagerContract.functions.whitelistApproveNode(
					signer.address
				);
				await ApproveFundsForContract(
					nodeManagerContract.address,
					getDecimalBN(10),
					signer
				);
				await nodeManagerContract
					.connect(signer)
					.functions.join(getDecimalBN(1), SAMPLE_WSS_URL);
			})
		);

		// send a report
		const responseTx = reportManagerContract
			.connect(sampleNode)
			.functions.report(...Object.values(reportData));

		await expect(responseTx).to.be.revertedWith(
			CUSTOM_EXCEPTIONS.QUORUM_NOT_MET
		);
	});

	it('ReportManager ---- Staked Node can submit report', async function () {
		const sampleNode = activeNodes[0];
		const blockNumber = await getLatestBlockNumber();
		const reportData = await generateReportData({
			bundleId: '75',
			blockheight: +blockNumber - 10,
			signer: sampleNode,
		});

		const responseTx = await reportManagerContract
			.connect(sampleNode)
			.functions.report(...Object.values(reportData));

		// validate the stirng emmitted by the contract is correct
		const { data: contractReportData } = generateReportHash(reportData);
		const event = await fetchEventArgsFromTx(responseTx, 'ReportAccepted');

		expect(event?.raw).to.be.equal(JSON.stringify(contractReportData));
	});

	it('NodeManager ---- Node manager can process submitted report', async function () {
		const currentNode = activeNodes[0];
		const consumerSigner = otherSigners[otherSigners.length - 2];
		const stakeAmount = getDecimalBN(70);
		// ------ submit a report
		const blockNumber = await getLatestBlockNumber();
		const reportData = await generateReportData({
			bundleId: '75',
			blockheight: +blockNumber - 10,
			signer: currentNode,
		});
		await reportManagerContract
			.connect(currentNode)
			.functions.report(...Object.values(reportData));
		// ---------------------------------------------- submit a report
		// ---- stake for the user in both query manager and store manager
		const queryManagerContract = await loadQueryManager(
			adminSigner,
			nodeManagerContract.address
		);
		await queryManagerContract
			.connect(consumerSigner)
			.functions.stake(SAMPLE_STREAM_ID, stakeAmount);
		const storeManagerContract = await loadStoreManager(
			adminSigner,
			nodeManagerContract.address
		);
		await storeManagerContract
			.connect(consumerSigner)
			.functions.stake(SAMPLE_STREAM_ID, stakeAmount);
		// ---- stake for the user in both query manager and store manager

		// ---- set the right contracts for the nodemanager contract
		nodeManagerContract.registerStoreManager(storeManagerContract.address);
		nodeManagerContract.registerQueryManager(queryManagerContract.address);
		nodeManagerContract.registerReportManager(reportManagerContract.address);
		//  ---- set the right contracts for the nodemanager contract
		const [preReportProcessBalance] = await token.functions.balanceOf(
			nodeManagerContract.address
		);
		const { stake: nodeStakePreProcess } =
			await nodeManagerContract.functions.nodes(currentNode.address);
		// ---- process the actual report
		const processReportTx = await nodeManagerContract
			.connect(currentNode)
			.functions.processReport(reportData.bundleId);
		// ---------------------------------------------- submit a report

		// ---------------------------------------------- verify the report
		const event = await fetchEventArgsFromTx(
			processReportTx,
			REPORT_MANAGER_EVENTS.REPORT_PROCESSED
		);
		expect(event?.id).to.equal(reportData.bundleId);

		const [postReportProcessBalance] = await token.functions.balanceOf(
			nodeManagerContract.address
		);
		const { stake: nodeStakePostProcess } =
			await nodeManagerContract.functions.nodes(currentNode.address);
		// -------- Verify that the right amount has been captured by the store manager contract
		const totalWrites = reportData.bytesObservedPerNode[0].reduce(
			(a, b) => a + b,
			0
		);
		const writeExpense = reportData.fee.div(totalWrites);
		const writeFee = writeExpense.mul(
			1 + NODE_MANAGER.WRITE_FEE_POINTS / 10000
		);
		const writeTreasuryFee =
			+writeFee.sub(writeExpense) *
			Math.floor(NODE_MANAGER.TREASURY_FEE_POINTS / 10000);

		const writeNodeFee = +writeFee - writeTreasuryFee;

		const totalWriteCapture = writeFee.mul(totalWrites);
		const stakeHolderBalance = await storeManagerContract.functions.balanceOf(
			consumerSigner.address
		);
		const [stakeHolderStoreBalance] =
			await storeManagerContract.functions.storeBalanceOf(
				consumerSigner.address,
				reportData.streams[0]
			);
		const [streamStoreBalance] = await storeManagerContract.functions.stores(
			reportData.streams[0]
		);
		const [totalSupply] = await storeManagerContract.functions.totalSupply();
		// validate the balances from the store contract
		expect(+stakeHolderBalance)
			.to.equal(+stakeAmount.sub(totalWriteCapture))
			.to.equal(+stakeHolderStoreBalance);
		expect(+streamStoreBalance)
			.to.equal(+stakeAmount.sub(totalWriteCapture))
			.to.equal(+totalSupply);

		// -------- Verify that the right amount has been captured by the store manager contract

		// ------- Verify the right amount has been captured by the query manager contract
		const readCapture = reportData.bytesQueriedPerConsumer[0][0];
		const readTreasuryFee =
			NODE_MANAGER.READ_FEE *
			Math.floor(NODE_MANAGER.TREASURY_FEE_POINTS / 10000);
		const readNodeFee = NODE_MANAGER.READ_FEE - readTreasuryFee;
		const totalRead = reportData.bytesQueriedPerConsumer[0].reduce(
			(a, b) => a + b,
			0
		);
		const readFee = NODE_MANAGER.READ_FEE;
		const totalReadCapture = readCapture * readFee;
		const qstakeHolderBalance = await queryManagerContract.functions.balanceOf(
			consumerSigner.address
		);
		const [qstakeHolderStoreBalance] =
			await queryManagerContract.functions.storeBalanceOf(
				consumerSigner.address,
				reportData.streams[0]
			);
		const [qstreamStoreBalance] = await queryManagerContract.functions.stores(
			reportData.streams[0]
		);
		const [qtotalSupply] = await queryManagerContract.functions.totalSupply();
		expect(+qstakeHolderBalance)
			.to.equal(+stakeAmount.sub(totalReadCapture))
			.to.equal(+qstakeHolderStoreBalance);
		expect(+qstreamStoreBalance)
			.to.equal(+stakeAmount.sub(totalReadCapture))
			.to.equal(+qtotalSupply);
		// ------- Verify the right amount has been captured by the query manager contract

		// ------- validate that the right amount of tokens have been transferred to the nodemanager contract
		expect(+postReportProcessBalance.sub(preReportProcessBalance)).to.equal(
			+totalWriteCapture + totalReadCapture
		);
		//-------  validate that the right amount of tokens have been transferred to the nodemanager contract

		// ------- Verify the node stake has been increased propportionately
		const bytesContributed =
			reportData.bytesObservedPerNode[0][0] -
			reportData.bytesMissedPerNode[0][0];
		const nodeWriteCapturePortion = Math.floor(bytesContributed / totalWrites);
		const nodeWriteCaptureAmount = bytesContributed * writeNodeFee;

		const nodeReadCaptureAmount =
			Math.floor(reportData.bytesQueriedPerConsumer[0][0] / totalRead) *
			Math.floor(totalRead * readNodeFee);
		let nodeStakeIncrement = nodeWriteCaptureAmount + nodeReadCaptureAmount;
		nodeStakeIncrement = nodeStakeIncrement < 0 ? 0 : nodeStakeIncrement;

		expect(nodeStakeIncrement).to.equal(
			+nodeStakePostProcess.sub(nodeStakePreProcess)
		);

		// ------- Verify the node stake has been increased propportionately

		//  ------- validate the delegatees have been balanced
		// since we only have this node, then the balance of the delegate should ave increased by nodeCaptureQueryPortion*100%
		const delegateStake = getDecimalBN(10); //all nodes joined with this value in functions.setupNodeManager
		const delegatesBalance = await nodeManagerContract.functions.delegatesOf(
			currentNode.address,
			currentNode.address
		);
		const delegatePortion =
			nodeWriteCapturePortion * 1 * nodeWriteCaptureAmount; //multiply by 1 since we ahve only one node

		expect(+delegatesBalance).to.equal(
			+delegateStake.add(BigNumber.from(`${delegatePortion}`))
		);
		//  ------- validate the delegatees have been balanced
	});
});
