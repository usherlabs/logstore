/**
 * Standlone Unit Test for ReportManager x NodeManager interoperation over Report Processing
 */
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber, Contract } from 'ethers';
import { ethers } from 'hardhat';

import {
	NODE_MANAGER_EVENTS,
	QUERY_MANAGER_EVENTS,
	REPORT_MANAGER_EVENTS, // REPORT_TIME_BUFFER,
	SAMPLE_STREAM_ID,
	STORE_MANAGER_EVENTS,
} from './utils/constants';
import {
	fetchEventArgsFromTx,
	generateContractReportPayload,
	generateReportData,
	getDecimalBN,
	getERC20Token,
	getLatestBlockNumber,
	loadQueryManager,
	loadReportManager,
	loadStoreManager,
	proofsToMean,
	setupNodeManager,
} from './utils/functions';

describe('ProcessReport (ReportManager x NodeManager)', async function () {
	let adminSigner: SignerWithAddress;
	let otherSigners: SignerWithAddress[];
	let activeNodes: SignerWithAddress[];
	let nodeManagerContract: Contract;
	let token: Contract;
	let blockHeight: number;

	beforeEach(async () => {
		const blockNumber = await getLatestBlockNumber();
		blockHeight = +blockNumber - 500;

		[adminSigner, ...otherSigners] = await ethers.getSigners();
		activeNodes = otherSigners.slice(0, 2);
		nodeManagerContract = await setupNodeManager(adminSigner, activeNodes);
		token = await getERC20Token(adminSigner);
	});

	it('should submit and then process the report', async function () {
		const currentNode = activeNodes[0];
		const consumerSigner = otherSigners[otherSigners.length - 2];
		const stakeAmount = getDecimalBN(70);

		// ------ setup report manager
		const reportData = await generateReportData({
			bundleId: '75',
			blockheight: blockHeight,
			signer: currentNode,
		});
		// Produce a payload with a single signer
		const { payload, proofs } = await generateContractReportPayload(
			activeNodes,
			reportData.systemReport
		);
		const reportTimeBuffer = 10 * 1000;
		const meanTimestamp = proofsToMean(proofs);
		const now = meanTimestamp + reportTimeBuffer;
		const seconds = Math.ceil(now / 1000);
		const reportManagerContract = await loadReportManager(
			adminSigner,
			nodeManagerContract.address,
			{ withTime: seconds, reportTimeBuffer }
		);

		// ---------------------------------------------- submit a report
		// ---- stake for the user in both query manager and store manager
		const queryManagerContract = await loadQueryManager(
			adminSigner,
			nodeManagerContract.address
		);
		await queryManagerContract
			.connect(consumerSigner)
			.functions.stake(stakeAmount);
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

		// console.log('Proofs:', proofs);
		const reportSubmitResponseTx = await reportManagerContract
			.connect(currentNode)
			.functions.report(...payload);

		// ---- Report submitted
		const acceptedEvent = await fetchEventArgsFromTx(
			reportSubmitResponseTx,
			REPORT_MANAGER_EVENTS.REPORT_ACCEPTED
		);
		expect(acceptedEvent?.id).to.be.equal(reportData.report.id);

		const [preReportProcessBalance] = await token.functions.balanceOf(
			nodeManagerContract.address
		);
		// ---- process the actual report
		const processReportTx = await nodeManagerContract
			.connect(currentNode)
			.functions.processReport(reportData.report.id);
		// ---------------------------------------------- submit a report
		// ---------------------------------------------- verify the report
		const event = await fetchEventArgsFromTx(
			processReportTx,
			NODE_MANAGER_EVENTS.REPORT_PROCESSED
		);
		expect(event?.id).to.equal(reportData.report.id);

		// validate store manager capture funds
		const consumerCapture = reportData.report.streams[0].capture;
		const userStoreBalance = await storeManagerContract.functions.balanceOf(
			consumerSigner.address
		);
		const [consumerStreamBalance] =
			await storeManagerContract.functions.storeBalanceOf(
				consumerSigner.address,
				reportData.report.streams[0].id
			);
		const [streamStoreBalance] = await storeManagerContract.functions.stores(
			reportData.report.streams[0].id
		);
		const [storeManagerTotalSupply] =
			await storeManagerContract.functions.totalSupply();
		// console.log('balances', {
		// 	userStoreBalance,
		// 	stakeAmount,
		// 	consumerCapture,
		// 	consumerStreamBalance,
		// 	streamStoreBalance,
		// 	storeManagerTotalSupply,
		// });
		expect(+userStoreBalance)
			.to.equal(+stakeAmount.sub(consumerCapture))
			.to.equal(+consumerStreamBalance)
			.to.equal(+streamStoreBalance)
			.to.equal(+storeManagerTotalSupply);

		// validate query manager capture function
		const totalReadCapture = reportData.report.consumers[0].capture;
		const [queryUserBalance] = await queryManagerContract.functions.balanceOf(
			consumerSigner.address
		);
		const [queryTotalSupply] =
			await queryManagerContract.functions.totalSupply();
		expect(+stakeAmount.sub(totalReadCapture))
			.to.equal(+queryUserBalance)
			.to.equal(+queryTotalSupply);

		// validate nodes
		const allNodes: Record<string, BigNumber> = reportData.report.nodes;
		const nodeAddresses = Object.keys(reportData.report.nodes); // Nodes first element
		const nodeAddressKey = nodeAddresses[0];
		const nodeIncrement = allNodes[nodeAddressKey];
		const foundNode = await nodeManagerContract.functions.nodes(nodeAddressKey);
		const initialNodeStake = getDecimalBN(10);
		// console.log('nodes', {
		// 	nodeAddressKey,
		// 	stake: foundNode.stake,
		// 	initialNodeStake,
		// 	nodeIncrement,
		// });
		expect(+foundNode.stake).to.equal(+initialNodeStake.add(nodeIncrement));

		// validate delegates
		const allDelegates: Record<string, Record<string, BigNumber>> = reportData
			.report.delegates;

		// ? This represents a wallet that delegates to itself -- ie. Wallet A starts a Node, and also delegates tokens to itself.
		const [nodeDelegateBalance] =
			await nodeManagerContract.functions.delegatesOf(
				nodeAddressKey, // delegate
				nodeAddressKey // nodeAddress that is delegated to
			);
		expect(+nodeDelegateBalance).to.equal(
			+initialNodeStake.add(allDelegates[nodeAddressKey][nodeAddressKey])
		);

		// validate total supply
		const treasurySupply = await nodeManagerContract.functions.treasurySupply();
		expect(+treasurySupply).to.equal(+reportData.report.treasury);
		// validate total supply

		// validate token balance has gone up by totalRead + totalWrite
		const totalIncrement = totalReadCapture.add(consumerCapture);
		const [postReportProcessBalance] = await token.functions.balanceOf(
			nodeManagerContract.address
		);

		expect(+postReportProcessBalance).to.equal(
			+preReportProcessBalance.add(totalIncrement)
		);
	});

	it('should use report with negative changes, submit and then process the report', async function () {
		const currentNode = activeNodes[0];
		const consumerSigner = otherSigners[otherSigners.length - 2];
		const stakeAmount = getDecimalBN(70);

		// ------ setup report manager
		const reportData = await generateReportData({
			bundleId: '75',
			blockheight: blockHeight,
			signer: currentNode,
			withNegatives: true,
		});

		// Produce a payload with a single signer
		const { payload, proofs } = await generateContractReportPayload(
			activeNodes,
			reportData.systemReport
		);
		const reportTimeBuffer = 10 * 1000;
		const meanTimestamp = proofsToMean(proofs);
		const now = meanTimestamp + reportTimeBuffer;
		const seconds = Math.ceil(now / 1000);
		const reportManagerContract = await loadReportManager(
			adminSigner,
			nodeManagerContract.address,
			{ withTime: seconds, reportTimeBuffer }
		);

		// ---------------------------------------------- submit a report
		// ---- stake for the user in both query manager and store manager
		const queryManagerContract = await loadQueryManager(
			adminSigner,
			nodeManagerContract.address
		);
		await queryManagerContract
			.connect(consumerSigner)
			.functions.stake(stakeAmount);
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

		const reportSubmitResponseTx = await reportManagerContract
			.connect(currentNode)
			.functions.report(...payload);

		// ---- Report submitted
		const acceptedEvent = await fetchEventArgsFromTx(
			reportSubmitResponseTx,
			REPORT_MANAGER_EVENTS.REPORT_ACCEPTED
		);
		expect(acceptedEvent?.id).to.be.equal(reportData.report.id);

		const [preReportProcessBalance] = await token.functions.balanceOf(
			nodeManagerContract.address
		);
		// ---- process the actual report
		const processReportTx = await nodeManagerContract
			.connect(currentNode)
			.functions.processReport(reportData.report.id);
		// ---------------------------------------------- submit a report
		// ---------------------------------------------- verify the report
		const event = await fetchEventArgsFromTx(
			processReportTx,
			NODE_MANAGER_EVENTS.REPORT_PROCESSED
		);
		expect(event?.id).to.equal(reportData.report.id);

		// validate store manager capture funds
		const consumerCapture = reportData.report.streams[0].capture;
		const userStoreBalance = await storeManagerContract.functions.balanceOf(
			consumerSigner.address
		);
		const [consumerStreamBalance] =
			await storeManagerContract.functions.storeBalanceOf(
				consumerSigner.address,
				reportData.report.streams[0].id
			);
		const [streamStoreBalance] = await storeManagerContract.functions.stores(
			reportData.report.streams[0].id
		);
		const [storeManagerTotalSupply] =
			await storeManagerContract.functions.totalSupply();
		// console.log('balances', {
		// 	userStoreBalance,
		// 	stakeAmount,
		// 	consumerCapture,
		// 	consumerStreamBalance,
		// 	streamStoreBalance,
		// 	storeManagerTotalSupply,
		// });
		expect(+userStoreBalance)
			.to.equal(+stakeAmount.sub(consumerCapture))
			.to.equal(+consumerStreamBalance)
			.to.equal(+streamStoreBalance)
			.to.equal(+storeManagerTotalSupply);

		// validate query manager capture function
		const totalReadCapture = reportData.report.consumers[0].capture;
		const [queryUserBalance] = await queryManagerContract.functions.balanceOf(
			consumerSigner.address
		);
		const [queryTotalSupply] =
			await queryManagerContract.functions.totalSupply();
		expect(+stakeAmount.sub(totalReadCapture))
			.to.equal(+queryUserBalance)
			.to.equal(+queryTotalSupply);

		// validate nodes
		const allNodes: Record<string, BigNumber> = reportData.report.nodes;
		const nodeAddresses = Object.keys(reportData.report.nodes); // Nodes first element
		const nodeAddressKey = nodeAddresses[0];
		const nodeIncrement = allNodes[nodeAddressKey];
		const foundNode = await nodeManagerContract.functions.nodes(nodeAddressKey);
		const initialNodeStake = getDecimalBN(10);
		// console.log('nodes', {
		// 	nodeAddressKey,
		// 	stake: foundNode.stake,
		// 	initialNodeStake,
		// 	nodeIncrement,
		// });
		expect(+foundNode.stake).to.equal(+initialNodeStake.add(nodeIncrement));

		// validate delegates
		const allDelegates: Record<string, Record<string, BigNumber>> = reportData
			.report.delegates;

		// ? This represents a wallet that delegates to itself -- ie. Wallet A starts a Node, and also delegates tokens to itself.
		const [nodeDelegateBalance] =
			await nodeManagerContract.functions.delegatesOf(
				nodeAddressKey, // delegate
				nodeAddressKey // nodeAddress that is delegated to
			);
		expect(+nodeDelegateBalance).to.equal(
			+initialNodeStake.add(allDelegates[nodeAddressKey][nodeAddressKey])
		);

		// validate total supply
		const treasurySupply = await nodeManagerContract.functions.treasurySupply();
		expect(+treasurySupply).to.equal(+reportData.report.treasury);
		// validate total supply

		// validate token balance has gone up by totalRead + totalWrite
		const totalIncrement = totalReadCapture.add(consumerCapture);
		const [postReportProcessBalance] = await token.functions.balanceOf(
			nodeManagerContract.address
		);

		expect(+postReportProcessBalance).to.equal(
			+preReportProcessBalance.add(totalIncrement)
		);
	});

	it('should use report with negative changes, and check overflow after processing report', async function () {
		const currentNode = activeNodes[0];
		const consumerSigner = otherSigners[otherSigners.length - 2];
		const stakeAmount = BigNumber.from(5000); // ? Stake some mini amount

		// ------ setup report manager
		const reportData = await generateReportData({
			bundleId: '75',
			blockheight: blockHeight,
			signer: currentNode,
		});

		// Produce a payload with a single signer
		const { payload, proofs } = await generateContractReportPayload(
			activeNodes,
			reportData.systemReport
		);
		const reportTimeBuffer = 10 * 1000;
		const meanTimestamp = proofsToMean(proofs);
		const now = meanTimestamp + reportTimeBuffer;
		const seconds = Math.ceil(now / 1000);
		const reportManagerContract = await loadReportManager(
			adminSigner,
			nodeManagerContract.address,
			{ withTime: seconds, reportTimeBuffer }
		);

		// ---------------------------------------------- submit a report
		// ---- stake for the user in both query manager and store manager
		const queryManagerContract = await loadQueryManager(
			adminSigner,
			nodeManagerContract.address
		);
		await queryManagerContract
			.connect(consumerSigner)
			.functions.stake(stakeAmount);
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

		const reportSubmitResponseTx = await reportManagerContract
			.connect(currentNode)
			.functions.report(...payload);

		// ---- Report submitted
		const acceptedEvent = await fetchEventArgsFromTx(
			reportSubmitResponseTx,
			REPORT_MANAGER_EVENTS.REPORT_ACCEPTED
		);
		expect(acceptedEvent?.id).to.be.equal(reportData.report.id);

		// ---- process the actual report
		const processReportTx = await nodeManagerContract
			.connect(currentNode)
			.functions.processReport(reportData.report.id);
		// ---------------------------------------------- submit a report
		// ---------------------------------------------- verify the report
		const event = await fetchEventArgsFromTx(
			processReportTx,
			NODE_MANAGER_EVENTS.REPORT_PROCESSED
		);
		expect(event?.id).to.equal(reportData.report.id);

		const processReportReceipt = await processReportTx.wait();
		// console.log('processReportReceipt.events', processReportReceipt);
		const postProcessStoreEvents = [
			...(await storeManagerContract.queryFilter(
				STORE_MANAGER_EVENTS.CAPTURE_OVERFLOW,
				processReportReceipt.blockNumber
			)),
			...(await storeManagerContract.queryFilter(
				STORE_MANAGER_EVENTS.SUPPLY_OVERFLOW,
				processReportReceipt.blockNumber
			)),
		];
		const postProcessQueryEvents = [
			...(await queryManagerContract.queryFilter(
				QUERY_MANAGER_EVENTS.CAPTURE_OVERFLOW,
				processReportReceipt.blockNumber
			)),
			...(await queryManagerContract.queryFilter(
				QUERY_MANAGER_EVENTS.SUPPLY_OVERFLOW,
				processReportReceipt.blockNumber
			)),
		];

		expect(postProcessStoreEvents[0].args?.overflow).to.equal(
			reportData.report.streams[0].capture.sub(stakeAmount)
		);
		expect(postProcessStoreEvents[1].args?.overflow).to.equal(
			reportData.report.streams[0].capture.sub(stakeAmount)
		);
		expect(postProcessQueryEvents[0].args?.overflow).to.equal(
			reportData.report.consumers[0].capture.sub(stakeAmount)
		);
		expect(postProcessQueryEvents[1].args?.overflow).to.equal(
			reportData.report.consumers[0].capture.sub(stakeAmount)
		);

		// validate store manager capture funds
		const userStoreBalance = await storeManagerContract.functions.balanceOf(
			consumerSigner.address
		);
		const [consumerStreamBalance] =
			await storeManagerContract.functions.storeBalanceOf(
				consumerSigner.address,
				reportData.report.streams[0].id
			);
		const [streamStoreBalance] = await storeManagerContract.functions.stores(
			reportData.report.streams[0].id
		);
		const [storeManagerTotalSupply] =
			await storeManagerContract.functions.totalSupply();
		expect(+userStoreBalance)
			.to.equal(0)
			.to.equal(+consumerStreamBalance)
			.to.equal(+streamStoreBalance)
			.to.equal(+storeManagerTotalSupply);

		// validate query manager capture function
		const [queryUserBalance] = await queryManagerContract.functions.balanceOf(
			consumerSigner.address
		);
		const [queryTotalSupply] =
			await queryManagerContract.functions.totalSupply();
		expect(+queryUserBalance)
			.to.equal(0)
			.to.equal(+queryTotalSupply);
	});
});
