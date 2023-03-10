import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { Contract } from 'ethers';
import { ethers } from 'hardhat';

import {
	NODE_MANAGER,
	NODE_MANAGER_EVENTS,
	SAMPLE_WSS_URL,
	ZERO_ADDRESS,
} from './utils/constants';
import {
	fetchEventArgsFromTx,
	generateWallet,
	loadNodeManager,
} from './utils/functions';

describe('Logstore', function () {
	let adminSigner: SignerWithAddress;
	let nodeManagerContract: Contract;

	beforeEach(async () => {
		[adminSigner] = await ethers.getSigners();
		nodeManagerContract = await loadNodeManager(adminSigner);
	});

	it('Insert Node - Can insert node as Admin', async function () {
		const newNodeAddress = generateWallet();
		const upsertNodeTx = await nodeManagerContract.functions.upsertNodeAdmin(
			newNodeAddress,
			SAMPLE_WSS_URL
		);
		const event = await fetchEventArgsFromTx(
			upsertNodeTx,
			NODE_MANAGER_EVENTS.NODE_UPDATED
		);
		const timeStamp = (await ethers.provider.getBlock('latest')).timestamp;
		const record = await nodeManagerContract.functions.nodes(newNodeAddress);

		// validate the content of the event and linkedlist record
		expect(String(timeStamp))
			.to.equal(String(event?.lastSeen))
			.to.equal(record?.lastSeen);
		expect(newNodeAddress.toLowerCase()).to.equal(
			event?.nodeAddress.toLowerCase()
		);
		expect(SAMPLE_WSS_URL).to.equal(event?.metadata).to.equal(record?.metadata);
		expect(String(1)).to.equal(String(event?.isNew));
		expect(String(NODE_MANAGER.INITIAL_NODES.length)).to.equal(
			String(record?.index)
		);
		expect(String(0)).to.equal(record.stake);
		expect(record.next).to.equal(ZERO_ADDRESS);
		expect(record.prev.toLowerCase()).to.equal(
			NODE_MANAGER.INITIAL_NODES[
				NODE_MANAGER.INITIAL_NODES.length - 1
			]?.toLowerCase()
		);
	});

	// ----- can register Store, QueryManager, ReportManager
});
