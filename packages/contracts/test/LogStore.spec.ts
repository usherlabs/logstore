import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { Contract } from 'ethers';
import { ethers } from 'hardhat';

import {
	CUSTOM_EXCEPTIONS,
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
	let otherSigners: SignerWithAddress[];
	let nodeManagerContract: Contract;

	beforeEach(async () => {
		[adminSigner, ...otherSigners] = await ethers.getSigners();
		nodeManagerContract = await loadNodeManager(adminSigner);
	});

	describe('Node Can join and Leave network', () => {
		it('Create Node - Can create node as Admin', async function () {
			const newNodeAddress = generateWallet();
			const initialNodeCount = await nodeManagerContract.functions.totalNodes();
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
			const finalNodeCount = await nodeManagerContract.functions.totalNodes();

			// validate the content of the event and linkedlist record
			expect(String(timeStamp))
				.to.equal(String(event?.lastSeen))
				.to.equal(record?.lastSeen);
			expect(newNodeAddress.toLowerCase()).to.equal(
				event?.nodeAddress.toLowerCase()
			);

			expect(+finalNodeCount).to.equal(+initialNodeCount + 1);
			expect(SAMPLE_WSS_URL)
				.to.equal(event?.metadata)
				.to.equal(record?.metadata);
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

		it('Update Node - Can update node as Admin', async function () {
			// update the metadata of the initially inserted node
			const nodeToEditAddress = NODE_MANAGER.INITIAL_NODES[0];
			const updatedNodeMetadata = `${SAMPLE_WSS_URL}/updated`;

			// get the initial record before updating
			const initialRecord = await await nodeManagerContract.functions.nodes(
				nodeToEditAddress
			);

			// valdiate this node has been inserted previously
			// a node has to have been inserted to perform an update operation
			expect(+initialRecord.lastSeen).to.not.equal(0);

			const upsertNodeTx = await nodeManagerContract.functions.upsertNodeAdmin(
				nodeToEditAddress,
				updatedNodeMetadata
			);
			const event = await fetchEventArgsFromTx(
				upsertNodeTx,
				NODE_MANAGER_EVENTS.NODE_UPDATED
			);
			// validate that an event was emitted with updated parameters
			expect(+event?.isNew).to.equal(+false);
			expect(event?.metadata).to.equal(updatedNodeMetadata);
			expect(event?.nodeAddress.toLowerCase()).to.equal(
				nodeToEditAddress.toLowerCase()
			);

			// fetch record and confirm change was persistent to the storage
			const updatedRecord = await await nodeManagerContract.functions.nodes(
				nodeToEditAddress
			);
			expect(updatedRecord.metadata).to.equal(updatedNodeMetadata);

			const timeStamp = (await ethers.provider.getBlock('latest')).timestamp;
			expect(+updatedRecord.lastSeen).to.equal(+timeStamp);
		});

		it('Remove Node - Can remove node as Admin', async function () {
			const nodeToDeleteAddress = NODE_MANAGER.INITIAL_NODES[0];
			const deleteNodeTx = await nodeManagerContract.functions.removeNodeAdmin(
				nodeToDeleteAddress
			);
			const event = await fetchEventArgsFromTx(
				deleteNodeTx,
				NODE_MANAGER_EVENTS.NODE_REMOVED
			);
			// validate the details emmited from the event
			expect(event?.nodeAddress.toLowerCase()).to.equal(
				nodeToDeleteAddress.toLowerCase()
			);
			// fetch the node from state and confirm it is really deleted
			const response = await nodeManagerContract.functions.nodes(
				nodeToDeleteAddress
			);
			expect(+response.lastSeen).to.equal(0);
		});

		it('Remove Node - Only admin can remove other nodes', async function () {
			const nodeToDeleteAddress = NODE_MANAGER.INITIAL_NODES[0];
			const otherUser = otherSigners[1];
			const deleteNodeTx = nodeManagerContract
				.connect(otherUser)
				.functions.removeNodeAdmin(nodeToDeleteAddress);

			await expect(deleteNodeTx).to.revertedWith(
				CUSTOM_EXCEPTIONS.OWNABLE_NOT_OWNER
			);
		});

		it('Upsert  Node - Only admin can upsert other nodes', async function () {
			const nodeAddress = NODE_MANAGER.INITIAL_NODES[0];
			const otherUser = otherSigners[1];
			const upsertNodeTx = nodeManagerContract
				.connect(otherUser)
				.functions.upsertNodeAdmin(nodeAddress, SAMPLE_WSS_URL);

			await expect(upsertNodeTx).to.revertedWith(
				CUSTOM_EXCEPTIONS.OWNABLE_NOT_OWNER
			);
		});
	});

	// it('Insert Node - Can insert node as Admin', async function () {

	// ----- can register Store, QueryManager, ReportManager
});
