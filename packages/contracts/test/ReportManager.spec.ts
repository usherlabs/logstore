import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { Contract } from 'ethers';
import { ethers } from 'hardhat';

import {
	CUSTOM_EXCEPTIONS,
	REPORT_MANAGER_EVENTS,
	SAMPLE_STREAM_ID,
} from './utils/constants';
import {
	fetchEventArgsFromTx,
	generateReportData,
	generateReportHash,
	getDecimalBN,
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

	beforeEach(async () => {
		[adminSigner, ...otherSigners] = await ethers.getSigners();
		activeNodes = otherSigners.slice(0, 10);
		nodeManagerContract = await setupNodeManager(adminSigner, activeNodes);
		reportManagerContract = await loadReportManager(
			adminSigner,
			nodeManagerContract
		);
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
		const sampleNode = activeNodes[0];
		const activeUser = otherSigners[otherSigners.length - 2];
		const stakeAmount = getDecimalBN(70);
		// ------ submit a report
		const blockNumber = await getLatestBlockNumber();
		const reportData = await generateReportData({
			bundleId: '75',
			blockheight: +blockNumber - 10,
			signer: sampleNode,
		});
		await reportManagerContract
			.connect(sampleNode)
			.functions.report(...Object.values(reportData));
		// ------ submit a report

		// ---- stake for the user in both query manager and store manager
		const queryManagerContract = await loadQueryManager(
			adminSigner,
			nodeManagerContract.address
		);
		await queryManagerContract
			.connect(activeUser)
			.functions.stake(SAMPLE_STREAM_ID, stakeAmount);
		const storeManagerContract = await loadStoreManager(
			adminSigner,
			nodeManagerContract.address
		);
		await storeManagerContract
			.connect(activeUser)
			.functions.stake(SAMPLE_STREAM_ID, stakeAmount);
		// ---- stake for the user in both query manager and store manager

		// ---- set the right contracts for the nodemanager contract
		nodeManagerContract.registerStoreManager(storeManagerContract.address);
		nodeManagerContract.registerQueryManager(queryManagerContract.address);
		nodeManagerContract.registerReportManager(reportManagerContract.address);
		//  ---- set the right contracts for the nodemanager contract

		// ---- process the actual report
		const processReportTx = await nodeManagerContract
			.connect(sampleNode)
			.functions.processReport(reportData.bundleId);

		const event = await fetchEventArgsFromTx(
			processReportTx,
			REPORT_MANAGER_EVENTS.REPORT_PROCESSED
		);
		// ---- Verify the event
		expect(event?.id).to.equal(reportData.bundleId);
		// ---- Verify the variables and delegates value from the formulas
	});
});
