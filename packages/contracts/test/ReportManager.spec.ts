import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { Contract } from 'ethers';
import { ethers } from 'hardhat';

import {
	CUSTOM_EXCEPTIONS,
	NODE_MANAGER,
	NODE_MANAGER_EVENTS,
	NODE_WHITELIST_STATE,
	SAMPLE_WSS_URL,
	ZERO_ADDRESS,
} from './utils/constants';
import {
	ApproveFundsForContract,
	fetchEventArgsFromTx,
	generateReportData,
	generateWallet,
	getDecimalBN,
	getERC20Token,
	getLatestBlockNumber,
	getTimeStamp,
	loadNodeManager,
	loadReportManager,
	setupNodeManager,
} from './utils/functions';

describe('ReportManager', async function () {
	let adminSigner: SignerWithAddress;
	let whitelistedNodeSigner: SignerWithAddress;
	let nodeSigner: SignerWithAddress;
	let otherSigners: SignerWithAddress[];
	let activeNodes: SignerWithAddress[];
	let reportManagerContract: Contract;
	let nodeManagerContract: Contract;

	beforeEach(async () => {
		[adminSigner, nodeSigner, whitelistedNodeSigner, ...otherSigners] =
			await ethers.getSigners();
		activeNodes = otherSigners.slice(0, 10);
		nodeManagerContract = await setupNodeManager(adminSigner, activeNodes);
		reportManagerContract = await loadReportManager(
			adminSigner,
			nodeManagerContract
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

		// validate by getting last saved report
		const event = await fetchEventArgsFromTx(responseTx, 'Logger');
		console.log({ event });
	});
});
