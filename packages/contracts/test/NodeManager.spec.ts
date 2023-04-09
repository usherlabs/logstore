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
	generateWallet,
	getDecimalBN,
	getERC20Token,
	loadNodeManager,
} from './utils/functions';

describe('NodeManager', function () {
	let adminSigner: SignerWithAddress;
	let whitelistedNodeSigner: SignerWithAddress;
	let nodeSigner: SignerWithAddress;
	let otherSigners: SignerWithAddress[];
	let nodeManagerContract: Contract;

	beforeEach(async () => {
		const amountToApprove = getDecimalBN(10);
		[adminSigner, nodeSigner, whitelistedNodeSigner, ...otherSigners] =
			await ethers.getSigners();
		// load the node manager contract
		nodeManagerContract = await loadNodeManager(adminSigner);
		// whitelist a node
		await nodeManagerContract.functions.whitelistApproveNode(
			whitelistedNodeSigner.address
		);
		// approve funds for the whitelisted node and admin account
		await ApproveFundsForContract(
			nodeManagerContract.address,
			amountToApprove,
			whitelistedNodeSigner
		);
		await ApproveFundsForContract(
			nodeManagerContract.address,
			amountToApprove,
			nodeSigner
		);
	});

	describe('Manage Nodes', () => {
		it('ManageNode ---- Admin can add a node', async function () {
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

		it('ManageNode ---- Admin can update a nodes', async function () {
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

		it('ManageNode ---- Admin can remove a node', async function () {
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

		it('ManageNode ---- Only Admin can remove other nodes', async function () {
			const nodeToDeleteAddress = NODE_MANAGER.INITIAL_NODES[0];
			const otherUser = otherSigners[1];
			const deleteNodeTx = nodeManagerContract
				.connect(otherUser)
				.functions.removeNodeAdmin(nodeToDeleteAddress);

			await expect(deleteNodeTx).to.revertedWith(
				CUSTOM_EXCEPTIONS.OWNABLE_NOT_OWNER
			);
		});

		it('ManageNode ---- Only Admin can upsert other nodes', async function () {
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

	describe('WhiteList Nodes', () => {
		it('WhiteListNodes ---- Admin can whitelistApproveNode', async function () {
			const nodeAddress = nodeSigner.address;
			const [prevNodeWhitelistState] =
				await nodeManagerContract.functions.whitelist(nodeAddress);
			expect(prevNodeWhitelistState).to.equal(NODE_WHITELIST_STATE.NONE);
			const whitelistNodeTx =
				await nodeManagerContract.functions.whitelistApproveNode(nodeAddress);
			const whitelistEvent = await fetchEventArgsFromTx(
				whitelistNodeTx,
				NODE_MANAGER_EVENTS.NOTE_WHITELIST_APPROVED
			);
			// validate event parameters are correctly configured
			expect(whitelistEvent?.nodeAddress).to.equal(nodeAddress);
			const [nodeWhitelistState] =
				await nodeManagerContract.functions.whitelist(nodeAddress);
			expect(nodeWhitelistState).to.equal(NODE_WHITELIST_STATE.APPROVED);
		});

		it('WhiteListNodes ---- Admin can whitelistRejectNode', async function () {
			const nodeAddress = otherSigners[1].address;
			const whitelistNodeTx =
				await nodeManagerContract.functions.whitelistApproveNode(nodeAddress);
			const whitelistEvent = await fetchEventArgsFromTx(
				whitelistNodeTx,
				NODE_MANAGER_EVENTS.NOTE_WHITELIST_APPROVED
			);
			// validate event parameters are correctly configured
			expect(whitelistEvent?.nodeAddress).to.equal(nodeAddress);
			const rejectNodeTx =
				await nodeManagerContract.functions.whitelistRejectNode(nodeAddress);
			const rejectEventEvent = await fetchEventArgsFromTx(
				rejectNodeTx,
				NODE_MANAGER_EVENTS.NOTE_WHITELIST_REJECTED
			);
			// validate event parameters are correctly configured
			expect(rejectEventEvent?.nodeAddress).to.equal(nodeAddress);
			const [nodeWhitelistState] =
				await nodeManagerContract.functions.whitelist(nodeAddress);
			expect(nodeWhitelistState).to.equal(NODE_WHITELIST_STATE.REJECTED);
		});

		it('WhiteListNodes ---- Admin can kickNode', async function () {
			const nodeAddress = NODE_MANAGER.INITIAL_NODES[0];
			const kickNodeTx = await nodeManagerContract.functions.kickNode(
				nodeAddress
			);
			const nodeRemovedEvent = await fetchEventArgsFromTx(
				kickNodeTx,
				NODE_MANAGER_EVENTS.NODE_REMOVED
			);
			expect(nodeRemovedEvent?.nodeAddress.toLowerCase()).to.equal(
				nodeAddress.toLowerCase()
			);
			const nodeRejectedEvent = await fetchEventArgsFromTx(
				kickNodeTx,
				NODE_MANAGER_EVENTS.NOTE_WHITELIST_REJECTED
			);
			expect(nodeRejectedEvent?.nodeAddress.toLowerCase()).to.equal(
				nodeAddress.toLowerCase()
			);
			// Fetch the removed node and confirmed it's removal was persisted to state
			const response = await nodeManagerContract.functions.nodes(nodeAddress);
			expect(+response.lastSeen).to.equal(0);
		});
	});

	describe('Join Network', async function () {
		it('JoinNetwork ---- un-whitelisted Node cannot join network', async function () {
			const response = nodeManagerContract
				.connect(nodeSigner)
				.functions.upsertNode(SAMPLE_WSS_URL);
			await expect(response).to.revertedWith(
				CUSTOM_EXCEPTIONS.NODE_NOT_WHITELISTED
			);
		});

		it('JoinNetwork ---- Whitelisted Node can join network', async function () {
			const newNodeAddress = whitelistedNodeSigner.address;
			const initialNodeCount = await nodeManagerContract.functions.totalNodes();
			const upsertNodeTx = await nodeManagerContract
				.connect(whitelistedNodeSigner)
				.functions.upsertNode(SAMPLE_WSS_URL);
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
	});

	describe('Stake Amount', async function () {
		it('StakeAmount ---- Nodes must stake more than 0 tokens', async function () {
			const stakeAmount = 0;
			const stakeTx = nodeManagerContract
				.connect(whitelistedNodeSigner)
				.functions.stake(stakeAmount);
			await expect(stakeTx).to.revertedWith(
				CUSTOM_EXCEPTIONS.STAKE_INSUFFICIENT_BALANCE
			);
		});
		it('StakeAmount ---- Nodes can stake an amount', async function () {
			const stakeAmount = getDecimalBN(1);
			const newNodeAddress = whitelistedNodeSigner.address;
			const contractAddress = nodeManagerContract.address;
			await ApproveFundsForContract(
				contractAddress,
				stakeAmount,
				whitelistedNodeSigner
			);
			await nodeManagerContract
				.connect(whitelistedNodeSigner)
				.functions.stake(stakeAmount);
			const userNodeBalance = await nodeManagerContract.balanceOf(
				newNodeAddress
			);
			expect(userNodeBalance).be.equal(stakeAmount);
		});
		it('StakeAmount ---- Nodes cannot withdraw more than staked amount', async function () {
			const stakeAmount = getDecimalBN(1);
			// stake amount and validate staked
			await nodeManagerContract
				.connect(whitelistedNodeSigner)
				.functions.stake(stakeAmount);
			// then withdraw amount and validate balances from contract and token
			const withdrawTx = nodeManagerContract
				.connect(whitelistedNodeSigner)
				.functions.withdraw(getDecimalBN(2));
			// validate error message
			await expect(withdrawTx).to.revertedWith(
				CUSTOM_EXCEPTIONS.INVALID_WITHDRAW_AMOUNT
			);
		});
		it('StakeAmount ---- Nodes can withdraw staked amount', async function () {
			const stakeAmount = getDecimalBN(1);
			const token = await getERC20Token(whitelistedNodeSigner);
			const newNodeAddress = whitelistedNodeSigner.address;
			// stake amount and validate staked
			await nodeManagerContract
				.connect(whitelistedNodeSigner)
				.functions.stake(stakeAmount);
			const preWithdrawContractBalance = await nodeManagerContract.balanceOf(
				newNodeAddress
			);
			const preWithdrawTokenBalance = await token.functions.balanceOf(
				newNodeAddress
			);
			expect(preWithdrawContractBalance).to.equal(stakeAmount);
			// then withdraw amount and validate balances from contract and token
			await nodeManagerContract
				.connect(whitelistedNodeSigner)
				.functions.withdraw(stakeAmount);
			// validate from node balance
			const postWithdrawContractBalance = await nodeManagerContract.balanceOf(
				newNodeAddress
			);
			const postWithdrawTokenBalance = await token.functions.balanceOf(
				newNodeAddress
			);
			expect(+postWithdrawContractBalance).to.equal(0);
			expect(+postWithdrawTokenBalance).to.be.greaterThan(
				+preWithdrawTokenBalance
			);
		});
	});

	describe('Delegate Stake', async function () {
		it('delegateStake ---- User cannot delegate zero amount stake to node', async function () {
			const stakeAmount = 0;
			const newNodeAddress = NODE_MANAGER.INITIAL_NODES[0];
			// let one user stake
			// stake amount and validate staked
			await nodeManagerContract
				.connect(whitelistedNodeSigner)
				.functions.stake(getDecimalBN(1));
			// and delegate zero amount to one of the initial nodes
			const delegateTx = nodeManagerContract
				.connect(whitelistedNodeSigner)
				.functions.delegate(stakeAmount, newNodeAddress);
			await expect(delegateTx).to.revertedWith(
				CUSTOM_EXCEPTIONS.INSUFFICIENT_DELEGATE_AMOUNT
			);
		});
		it('delegateStake ---- User cannot delegate to node that doesnt exist', async function () {
			const stakeAmount = getDecimalBN(1);
			const newNodeAddress = generateWallet();
			// let one user stake
			// stake amount and validate staked
			await nodeManagerContract
				.connect(whitelistedNodeSigner)
				.functions.stake(stakeAmount);
			// and delegate zero amount to one of the initial nodes
			const delegateTx = nodeManagerContract
				.connect(whitelistedNodeSigner)
				.functions.delegate(stakeAmount, newNodeAddress);
			await expect(delegateTx).to.revertedWith(
				CUSTOM_EXCEPTIONS.NONE_EXISTENT_NODE
			);
		});
		it('delegateStake ---- User can delegate stake to node', async function () {
			const stakeAmount = getDecimalBN(1);
			const newNodeAddress = NODE_MANAGER.INITIAL_NODES[0];
			// let one user stake
			// stake amount and validate staked
			await nodeManagerContract
				.connect(whitelistedNodeSigner)
				.functions.stake(stakeAmount);
			const preDelegateContractBalance =
				await nodeManagerContract.functions.balanceOf(
					whitelistedNodeSigner.address
				);
			const { stake: preDelegateNodeStake } =
				await nodeManagerContract.functions.nodes(newNodeAddress);
			// and delegate to one of the initial nodes
			const delegateTx = await nodeManagerContract
				.connect(whitelistedNodeSigner)
				.functions.delegate(stakeAmount, newNodeAddress);
			const delegateEvent = await fetchEventArgsFromTx(
				delegateTx,
				NODE_MANAGER_EVENTS.NODE_STAKE_UPDATED
			);
			const postDelegateContractBalance =
				await nodeManagerContract.functions.balanceOf(
					whitelistedNodeSigner.address
				);
			const { stake: postDelegateNodeStake } =
				await nodeManagerContract.functions.nodes(newNodeAddress);
			// validate event address and stake
			expect(delegateEvent?.nodeAddress.toLowerCase()).to.equal(
				newNodeAddress.toLowerCase()
			);
			expect(delegateEvent?.stake).to.equal(stakeAmount);
			expect(+preDelegateContractBalance).to.be.greaterThan(
				+postDelegateContractBalance
			);
			expect(+preDelegateNodeStake).to.be.equal(0);
			expect(postDelegateNodeStake).to.be.equal(stakeAmount);
			// fetch state from contract to validate
		});
		it('undelegateStake ---- User can undelegate stake to node', async function () {
			const stakeAmount = getDecimalBN(1);
			const newNodeAddress = NODE_MANAGER.INITIAL_NODES[0];
			// let one user stake
			// stake amount and validate staked
			await nodeManagerContract
				.connect(whitelistedNodeSigner)
				.functions.stake(stakeAmount);
			// and delegate to one of the initial nodes
			await nodeManagerContract
				.connect(whitelistedNodeSigner)
				.functions.delegate(stakeAmount, newNodeAddress);
			const delegateTx = await nodeManagerContract
				.connect(whitelistedNodeSigner)
				.functions.undelegate(stakeAmount, newNodeAddress);
			const delegateEvent = await fetchEventArgsFromTx(
				delegateTx,
				NODE_MANAGER_EVENTS.NODE_STAKE_UPDATED
			);
			// validate event
			expect(delegateEvent?.nodeAddress.toLowerCase()).to.equal(
				newNodeAddress.toLowerCase()
			);
			expect(+delegateEvent?.stake).to.equal(0);
			// validate state
			const delegatesOfWhitelistedNodeStake =
				await nodeManagerContract.functions.delegatesOf(
					whitelistedNodeSigner.address,
					newNodeAddress
				);
			expect(+delegatesOfWhitelistedNodeStake).to.equal(0);
			// teh bakance of the user should increase since they have undelegated
			const senderContractBalance =
				await nodeManagerContract.functions.balanceOf(
					whitelistedNodeSigner.address
				);
			expect(+senderContractBalance).to.be.equal(+stakeAmount);
			// validate the stake variable in the node struct
			const { stake: nodeStakeAfterUndelegation } =
				await nodeManagerContract.functions.nodes(newNodeAddress);
			expect(+nodeStakeAfterUndelegation).to.be.equal(0);
		});
	});
	describe('Compound Actions', async function () {
		it('CompoundActions ---- Node can Join(stake -> delegate -> upsertNode) network', async function () {
			const stakeAmount = getDecimalBN(1);
			const nodeAddress = whitelistedNodeSigner.address;
			const joinTx = await nodeManagerContract
				.connect(whitelistedNodeSigner)
				.functions.join(stakeAmount, SAMPLE_WSS_URL);
			// validate node was added
			const nodeAddedEvent = await fetchEventArgsFromTx(
				joinTx,
				NODE_MANAGER_EVENTS.NODE_UPDATED
			);
			expect(nodeAddedEvent?.nodeAddress).to.be.equal(nodeAddress);
			expect(+nodeAddedEvent?.isNew).to.be.equal(+true);
			expect(nodeAddedEvent?.metadata).to.equal(SAMPLE_WSS_URL);
			// validate the staked amount
			const delegationEvent = await fetchEventArgsFromTx(
				joinTx,
				NODE_MANAGER_EVENTS.NODE_STAKE_UPDATED
			);
			const delegatesBalance = await nodeManagerContract.functions.delegatesOf(
				nodeAddress,
				nodeAddress
			);
			expect(delegationEvent?.nodeAddress).to.equal(nodeAddress);
			expect(+delegationEvent?.stake)
				.to.equal(+stakeAmount)
				.to.equal(+delegatesBalance);
		});
		it('CompoundActions ----- Node can leave(undelegate ---> withdraw ---> removeNode )', async function () {
			const stakeAmount = getDecimalBN(1);
			const tokenContract = await getERC20Token(adminSigner);
			await nodeManagerContract
				.connect(whitelistedNodeSigner)
				.functions.join(stakeAmount, SAMPLE_WSS_URL);
			// validate node was added
			const preWithdrawTokenBalance = await tokenContract.functions.balanceOf(
				whitelistedNodeSigner.address
			);
			// const nodeAddress = whitelistedNodeSigner.address;
			await nodeManagerContract
				.connect(whitelistedNodeSigner)
				.functions.leave();
			// validate the funds staked reflects in the token balance of the user
			const postWithdrawTokenBalance = await tokenContract.functions.balanceOf(
				whitelistedNodeSigner.address
			);
			expect(+postWithdrawTokenBalance).to.be.greaterThan(
				+preWithdrawTokenBalance
			);
		});
		it('CompoundActions ----- Node can undelegateWithdraw(undelegate ---> withdraw)', async function () {
			const stakeAmount = getDecimalBN(1);
			const tokenContract = await getERC20Token(adminSigner);
			await nodeManagerContract
				.connect(whitelistedNodeSigner)
				.functions.join(stakeAmount, SAMPLE_WSS_URL);
			// validate node was added
			const preWithdrawTokenBalance = await tokenContract.functions.balanceOf(
				whitelistedNodeSigner.address
			);
			// const nodeAddress = whitelistedNodeSigner.address;
			const undelegateWithdrawTx = await nodeManagerContract
				.connect(whitelistedNodeSigner)
				.functions.undelegateWithdraw(
					stakeAmount,
					whitelistedNodeSigner.address
				);
			const undelegateEvent = await fetchEventArgsFromTx(
				undelegateWithdrawTx,
				NODE_MANAGER_EVENTS.NODE_STAKE_UPDATED
			);
			expect(undelegateEvent?.nodeAddress).to.be.equal(
				whitelistedNodeSigner.address
			);
			expect(+undelegateEvent?.stake).to.be.equal(0);
			// validate the funds staked reflects in the token balance of the user
			const postWithdrawTokenBalance = await tokenContract.functions.balanceOf(
				whitelistedNodeSigner.address
			);
			expect(+postWithdrawTokenBalance).to.be.greaterThan(
				+preWithdrawTokenBalance
			);
		});
	});
	describe('Utility Functions', async function () {
		it('UtilityFunctions(nodeAddresses) ----> Can correctly fetch all node addresses', async function () {
			const [initialNodeAddresses] =
				await nodeManagerContract.functions.nodeAddresses();
			const initialNodeLength = NODE_MANAGER.INITIAL_NODES.length;
			// validate the initial nodes are present and accurate
			expect(+initialNodeAddresses.length).to.equal(initialNodeLength);
			expect(initialNodeAddresses[0]).to.be.equal(
				NODE_MANAGER.INITIAL_NODES[0]
			);
			// add a new node and valdiate the data is consistently persisted
			const newNodeAddress = whitelistedNodeSigner.address;
			await nodeManagerContract
				.connect(whitelistedNodeSigner)
				.functions.join(getDecimalBN(1), SAMPLE_WSS_URL);
			const [contractNodeCount] =
				await nodeManagerContract.functions.totalNodes();
			const [updatedNodeAddresses] =
				await nodeManagerContract.functions.nodeAddresses();
			expect(+updatedNodeAddresses.length)
				.to.equal(initialNodeLength + 1)
				.to.equal(+contractNodeCount);
			expect(updatedNodeAddresses[1]).to.be.equal(newNodeAddress);
			// validate the total nodes variabls
		});
		it('UtilityFunctions(countNodes) ----> countNodes variable ', async function () {
			// get initial counts
			const [initialNodeCountFromFunc] =
				await nodeManagerContract.functions.countNodes();
			const [initialNodeCountFromVar] =
				await nodeManagerContract.functions.countNodes();
			expect(+initialNodeCountFromFunc)
				.to.equal(+initialNodeCountFromVar)
				.to.equal(1);
			// add a new node
			await nodeManagerContract
				.connect(whitelistedNodeSigner)
				.functions.join(getDecimalBN(1), SAMPLE_WSS_URL);
			// count again and confirm it is consistent
			const [finallNodeCountFromFunc] =
				await nodeManagerContract.functions.countNodes();
			const [finallNodeCountFromVar] =
				await nodeManagerContract.functions.countNodes();
			expect(+finallNodeCountFromFunc)
				.to.equal(+finallNodeCountFromVar)
				.to.equal(2);
		});
	});

	// ----- can register Store, QueryManager, ReportManager
});
