import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { Contract } from 'ethers';
import { ethers } from 'hardhat';

import { SAMPLE_WSS_URL } from './utils/constants';
import { generateWallet, loadNodeManager } from './utils/functions';

describe('NodeManager #2', function () {
	let adminSigner: SignerWithAddress;
	let nodeManagerContract: Contract;
	let startBlockNumberBeforeAnything: any;

	before(async () => {
		[adminSigner] = await ethers.getSigners();
		// load the node manager contract
		nodeManagerContract = await loadNodeManager(adminSigner);

		// Remove this first node...
		const [headNode] = await nodeManagerContract.functions.headNode();
		if (headNode) {
			await (
				await nodeManagerContract.functions.removeNodeAdmin(headNode)
			).wait();
		}

		startBlockNumberBeforeAnything =
			await nodeManagerContract.functions.startBlockNumber();
	});

	describe('Start Block', () => {
		const managedNodeAddress = generateWallet();
		it('Start Block ---- Should be empty to start', async () => {
			expect(Number(startBlockNumberBeforeAnything)).to.equal(0);
		});
		it('Start Block ---- Should be valued after adding a node', async () => {
			const tx = await nodeManagerContract.functions.upsertNodeAdmin(
				managedNodeAddress,
				SAMPLE_WSS_URL
			);
			const startBlockNumber =
				await nodeManagerContract.functions.startBlockNumber();
			expect(Number(startBlockNumber)).to.equal(Number(tx.blockNumber));
		});
		it('Start Block ---- Should be empty after removing all nodes', async () => {
			await nodeManagerContract.functions.removeNodeAdmin(managedNodeAddress);
			const startBlockNumber =
				await nodeManagerContract.functions.startBlockNumber();
			expect(Number(startBlockNumber)).to.equal(0);
		});
	});

	// ----- can register Store, QueryManager, ReportManager
});
