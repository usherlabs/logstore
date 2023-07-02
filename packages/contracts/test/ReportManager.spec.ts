import { time } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { Contract } from 'ethers';
import { ethers } from 'hardhat';

import {
	CUSTOM_EXCEPTIONS,
	NODE_MANAGER,
	REPORT_MANAGER_EVENTS,
	SAMPLE_WSS_URL,
} from './utils/constants';
import {
	ApproveFundsForContract,
	fetchEventArgsFromTx,
	generateContractReportPayload,
	generateReportData,
	getDecimalBN,
	getLatestBlockNumber,
	loadReportManager,
	proofsToMean,
	setupNodeManager,
} from './utils/functions';

describe('ReportManager', async function () {
	let adminSigner: SignerWithAddress;
	let otherSigners: SignerWithAddress[];
	let activeNodes: SignerWithAddress[];
	let reportManagerContract: Contract;
	let nodeManagerContract: Contract;
	let blockHeight: number;

	beforeEach(async () => {
		const blockNumber = await getLatestBlockNumber();
		blockHeight = +blockNumber - 500;

		[adminSigner, ...otherSigners] = await ethers.getSigners();
		activeNodes = otherSigners.slice(0, 2);
		nodeManagerContract = await setupNodeManager(adminSigner, activeNodes);
		reportManagerContract = await loadReportManager(
			adminSigner,
			nodeManagerContract.address,
			{}
		);
	});

	describe('Setup', () => {
		it('Nodes become a part of the reporter list', async function () {
			// get all reports
			const [reporters] = await reportManagerContract.functions.getReporters();

			// get all nodes
			const [nodes] = await nodeManagerContract.functions.nodeAddresses();

			// make sure they are uniquely of the same length
			const uniqueReports = [...new Set(reporters)];
			const uniqueNodes = [...new Set(nodes)];

			expect(uniqueReports.length).to.be.equal(uniqueNodes.length);
		});

		it('Block timestamp is handled correctly', async function () {
			// A test to ensure time.increaseTo actually works.
			const now = Date.now();
			const seconds = Math.floor(now / 1000);
			await time.increaseTo(seconds);
			const blockTimestamp =
				await reportManagerContract.functions.blockTimestamp();
			expect(+blockTimestamp).to.be.equals(seconds * 1000 * Math.pow(10, 10));

			const thisReportManagerContract = await loadReportManager(
				adminSigner,
				nodeManagerContract.address,
				{ withTime: seconds }
			);
			const blockTimestamp2 =
				await thisReportManagerContract.functions.blockTimestamp();
			expect(+blockTimestamp2).to.be.equals(seconds * 1000 * Math.pow(10, 10));
		});

		it('Manage reporter data correctly', async function () {
			const sampleNode = activeNodes[0];
			const reportData = await generateReportData({
				bundleId: '75',
				blockheight: blockHeight,
				signer: sampleNode,
			});

			const { proofs } = await generateContractReportPayload(
				activeNodes,
				reportData.systemReport
			);

			const activeAddresses = [
				// Dedupe the array of addresses
				...new Set([
					...NODE_MANAGER.INITIAL_NODES,
					...activeNodes.map((n) => n.address),
				]),
			];

			// const [reporters] = await reportManagerContract.functions.getReporters();
			const totalNodes = await nodeManagerContract.functions.totalNodes();
			const proofSignatures = proofs.map((proof) => proof.signature);
			// const proofTimestamps = proofs.map((proof) => proof.timestamp);
			// const meanTimestamp = proofsToMean(proofs);
			expect(
				Number(totalNodes),
				'Total nodes should equal activeNodes'
			).to.be.equal(activeAddresses.length);
			expect(
				proofSignatures.length,
				'expect signature length to be length of activeNodes'
			).to.be.equal(activeNodes.length);
		});
	});

	/**
	 * ------------------------------------------------------------------------------------------
	 * ------------------------------------------------------------------------------------------
	 * TEST REPORTER VALIDITY CHECK
	 * ------------------------------------------------------------------------------------------
	 * ------------------------------------------------------------------------------------------
	 */

	describe('Reporter Validity', () => {
		it('Node IS a valid reporter', async function () {
			// Kick the initial reporter
			await nodeManagerContract.functions.removeNodeAdmin(
				NODE_MANAGER.INITIAL_NODES[0]
			);

			const sampleNode = activeNodes[0];
			// get all reports
			const reportData = await generateReportData({
				bundleId: '75',
				blockheight: blockHeight,
				signer: sampleNode,
			});

			const { proofs } = await generateContractReportPayload(
				activeNodes,
				reportData.systemReport
			);
			const proofTimestamps = proofs.map((proof) => proof.timestamp);
			const meanTimestamp = proofsToMean(proofs);

			const meanToSeconds = Math.ceil(meanTimestamp / 1000); // current block ts is > start
			const thisReportManagerContract = await loadReportManager(
				adminSigner,
				nodeManagerContract.address,
				{ withTime: meanToSeconds }
			);

			// get all nodes
			const [validReporter] = await thisReportManagerContract
				.connect(sampleNode)
				.functions.canReport(proofTimestamps);

			expect(validReporter).to.be.equal(true);
		});

		it('Node IS NOT a valid reporter', async function () {
			const now = Date.now();
			const seconds = Math.floor(now / 1000);
			const thisReportManagerContract = await loadReportManager(
				adminSigner,
				nodeManagerContract.address,
				{ withTime: seconds }
			);

			const sampleNode = activeNodes[1];
			// get all reports
			const reportData = await generateReportData({
				bundleId: '75',
				blockheight: blockHeight,
				signer: sampleNode,
			});

			const { proofs } = await generateContractReportPayload(
				activeNodes,
				reportData.systemReport
			);
			const proofTimestamps = proofs.map((proof) => proof.timestamp);

			// get all nodes
			const [validReporter] = await thisReportManagerContract
				.connect(sampleNode)
				.functions.canReport(proofTimestamps);

			expect(validReporter).to.be.equal(false);
		});

		it('Node IS a valid reporter after 4 cycles', async function () {
			// Kick the initial reporter
			await nodeManagerContract.functions.removeNodeAdmin(
				NODE_MANAGER.INITIAL_NODES[0]
			);

			const [reporters] = await reportManagerContract.functions.getReporters();

			const sampleNode = activeNodes[0];
			// get all reports
			const reportData = await generateReportData({
				bundleId: '75',
				blockheight: blockHeight,
				signer: sampleNode,
			});

			const { proofs } = await generateContractReportPayload(
				activeNodes,
				reportData.systemReport
			);
			const proofTimestamps = proofs.map((proof) => proof.timestamp);
			const meanTimestamp = proofsToMean(proofs);

			const reportTimeBuffer = 10 * 1000;
			const now = meanTimestamp + reportTimeBuffer * reporters.length * 4;
			const seconds = Math.ceil(now / 1000);
			const thisReportManagerContract = await loadReportManager(
				adminSigner,
				nodeManagerContract.address,
				{ withTime: seconds, reportTimeBuffer }
			);

			// get all nodes
			const [validReporter] = await thisReportManagerContract
				.connect(sampleNode)
				.functions.canReport(proofTimestamps);

			expect(validReporter).to.be.equal(true);
		});

		it('Node IS NOT a valid reporter after 4 cycles', async function () {
			const [reporters] = await reportManagerContract.functions.getReporters();

			const sampleNode = activeNodes[1];
			// get all reports
			const reportData = await generateReportData({
				bundleId: '75',
				blockheight: blockHeight,
				signer: sampleNode,
			});

			const { proofs } = await generateContractReportPayload(
				activeNodes,
				reportData.systemReport
			);
			const proofTimestamps = proofs.map((proof) => proof.timestamp);
			const meanTimestamp = proofsToMean(proofs);

			const reportTimeBuffer = 10 * 1000;
			const now = meanTimestamp + reportTimeBuffer * reporters.length * 4;
			const seconds = Math.ceil(now / 1000);
			const thisReportManagerContract = await loadReportManager(
				adminSigner,
				nodeManagerContract.address,
				{ withTime: seconds, reportTimeBuffer }
			);

			// get all nodes
			const [validReporter] = await thisReportManagerContract
				.connect(sampleNode)
				.functions.canReport(proofTimestamps);

			expect(validReporter).to.be.equal(false);
		});
	});

	/**
	 * ------------------------------------------------------------------------------------------
	 * ------------------------------------------------------------------------------------------
	 * TEST REPORT SUBMISSION
	 * ------------------------------------------------------------------------------------------
	 * ------------------------------------------------------------------------------------------
	 */

	describe('Report Submission', () => {
		it('Invalid Reporter Node cannot submit report', async function () {
			const sampleNode = activeNodes[1];
			const reportData = await generateReportData({
				bundleId: '75',
				blockheight: blockHeight,
				signer: sampleNode,
			});
			const { payload } = await generateContractReportPayload(
				activeNodes,
				reportData.systemReport
			);

			const now = Date.now();
			const seconds = Math.floor(now / 1000);
			const thisReportManagerContract = await loadReportManager(
				adminSigner,
				nodeManagerContract.address,
				{ withTime: seconds }
			);

			const responseTx = thisReportManagerContract
				.connect(sampleNode)
				.functions.report(...payload);

			await expect(responseTx).to.be.revertedWith(
				CUSTOM_EXCEPTIONS.INVALID_REPORTER
			);
		});

		it('Staked Node can submit report', async function () {
			// Kick the initial reporter
			await nodeManagerContract.functions.removeNodeAdmin(
				NODE_MANAGER.INITIAL_NODES[0]
			);

			const sampleNode = activeNodes[0];
			const reportData = await generateReportData({
				bundleId: '75',
				blockheight: blockHeight,
				signer: sampleNode,
			});

			// Create proofs are reporter contract load
			const { payload, proofs } = await generateContractReportPayload(
				activeNodes,
				reportData.systemReport
			);
			const meanTimestamp = proofsToMean(proofs);

			const seconds = Math.ceil(meanTimestamp / 1000);
			const thisReportManagerContract = await loadReportManager(
				adminSigner,
				nodeManagerContract.address,
				{ withTime: seconds }
			);

			const responseTx = await thisReportManagerContract
				.connect(sampleNode)
				.functions.report(...payload);

			const event = await fetchEventArgsFromTx(
				responseTx,
				REPORT_MANAGER_EVENTS.REPORT_ACCEPTED
			);
			expect(event?.id).to.be.equal(reportData.report.id);

			// ? Tests for reputation management
			const [reporters] =
				await thisReportManagerContract.functions.getReporters();
			const reputations = await Promise.all(
				reporters.map(async (r: string) => {
					const rep = await thisReportManagerContract.functions.reputationOf(r);
					return +rep;
				})
			);
			expect(
				reporters[0],
				'Post Report Reputation: Reporter 0 have lead reporting role'
			).to.be.equal(sampleNode.address);
			expect(
				reputations[0],
				'Post Report Reputation: Reporter 0 to have reputation of 10'
			).to.be.equal(10);
			expect(
				reporters[1],
				'Post Report Reputation: Reporter 1 to be second reporter'
			).to.be.equal(activeNodes[1].address);
			expect(
				reputations[1],
				'Post Report Reputation: Reporter 1 to reputation of 1'
			).to.be.equal(1);
		});

		it('(Frontrunning Prevention) Only one reporter at a time', async function () {
			// Kick the initial reporter
			await nodeManagerContract.functions.removeNodeAdmin(
				NODE_MANAGER.INITIAL_NODES[0]
			);

			const reporter1 = activeNodes[0];
			const reporter2 = activeNodes[1];
			const reportData = await generateReportData({
				bundleId: '75',
				blockheight: blockHeight,
				signer: reporter1,
			});

			const { payload, proofs } = await generateContractReportPayload(
				activeNodes,
				reportData.systemReport
			);

			// const proofSignatures = proofs.map((proof) => proof.signature);
			const meanTimestamp = proofsToMean(proofs);
			const reportTimeBuffer = 10 * 1000;

			const now = meanTimestamp + reportTimeBuffer; // Give second reporter authorisation
			const seconds = Math.ceil(now / 1000);
			const thisReportManagerContract = await loadReportManager(
				adminSigner,
				nodeManagerContract.address,
				{ withTime: seconds, reportTimeBuffer }
			);

			const responseTx1 = thisReportManagerContract
				.connect(reporter1)
				.functions.report(...payload);

			await expect(responseTx1).to.be.revertedWith(
				CUSTOM_EXCEPTIONS.INVALID_REPORTER
			);

			const responseTx2 = await thisReportManagerContract
				.connect(reporter2)
				.functions.report(...payload);

			const event = await fetchEventArgsFromTx(
				responseTx2,
				REPORT_MANAGER_EVENTS.REPORT_ACCEPTED
			);
			expect(event?.id).to.be.equal(reportData.report.id);

			// ? Tests for reputation management
			const [reporters] =
				await thisReportManagerContract.functions.getReporters();
			const reputation1 =
				await thisReportManagerContract.functions.reputationOf(
					reporter1.address
				);
			const reputation2 =
				await thisReportManagerContract.functions.reputationOf(
					reporter2.address
				);
			expect(
				reporters[0],
				'Post Report Reputation: Reporter 0 have second reporting role'
			).to.be.equal(reporter2.address);
			expect(
				+reputation2,
				'Post Report Reputation: Reporter 0 to have reputation of 1'
			).to.be.equal(10);
			expect(
				reporters[1],
				'Post Report Reputation: Reporter 1 to be lead reporter'
			).to.be.equal(reporter1.address);
			expect(
				+reputation1,
				'Post Report Reputation: Reporter 1 (original Lead Reporter) to be penalised with reputation of 0'
			).to.be.equal(0);
		});

		it('un-staked Node cannot submit report', async function () {
			// use the 15th because node 0-10 have been staked and we need an unstaked node
			const sampleNode = otherSigners[15];

			const reportData = await generateReportData({
				bundleId: '75',
				blockheight: blockHeight,
				signer: sampleNode,
			});

			const { payload } = await generateContractReportPayload(
				activeNodes,
				reportData.systemReport
			);

			const responseTx = reportManagerContract
				.connect(sampleNode)
				.functions.report(...payload);

			await expect(responseTx).to.be.revertedWith(
				CUSTOM_EXCEPTIONS.STAKE_REQUIRED
			);
		});

		it('Staked Node can only submit report when quorum is met', async function () {
			const sampleNode = activeNodes[0];
			const reportData = await generateReportData({
				bundleId: '75',
				blockheight: blockHeight,
				signer: sampleNode,
			});

			// Produce a payload with a single signer
			const { payload } = await generateContractReportPayload(
				[sampleNode],
				reportData.systemReport
			);

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
				.functions.report(...payload);

			await expect(responseTx).to.be.revertedWith(
				CUSTOM_EXCEPTIONS.QUORUM_NOT_MET
			);
		});
	});
});
