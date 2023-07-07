import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { Contract } from 'ethers';
import { ethers } from 'hardhat';

import {
	CONSUMER_INDEX,
	CUSTOM_EXCEPTIONS,
	QUERY_MANAGER_EVENTS,
} from './utils/constants';
import {
	fetchEventArgsFromTx,
	getDecimalBN,
	getERC20Token,
	loadNodeManager,
	loadQueryManager,
} from './utils/functions';

describe('QueryManager', async function () {
	let adminSigner: SignerWithAddress;
	let otherSigners: SignerWithAddress[];
	let queryManagerContract: Contract;
	let CONSUMER_ADDRESS: string;

	beforeEach(async () => {
		const allSigners = await ethers.getSigners();
		[adminSigner, ...otherSigners] = allSigners;
		CONSUMER_ADDRESS = allSigners[CONSUMER_INDEX].address;
		const nodeManagerContract = await loadNodeManager(adminSigner);
		queryManagerContract = await loadQueryManager(
			adminSigner,
			nodeManagerContract.address
		);
	});

	describe('Stake', async function () {
		it('Stake ---- A user cannot stake zero funds', async function () {
			// define variables
			// define variables
			const activeUser = otherSigners[otherSigners.length - 2];
			const stakeAmount = 0;

			// fetch the balance of the contract before a user stakes
			const stakeTx = queryManagerContract
				.connect(activeUser)
				.functions.stake(stakeAmount);
			await expect(stakeTx).to.revertedWith(
				CUSTOM_EXCEPTIONS.STAKE_INSUFFICIENT_BALANCE
			);
		});

		it('Stake ---- A user can stake some funds', async function () {
			// define variables
			const activeUser = otherSigners[otherSigners.length - 2];
			const stakeAmount = getDecimalBN(1);
			const ercToken = await getERC20Token(adminSigner);
			// fetch the balance of the contract before a user stakes
			const [contractPreStakeBalance] = await ercToken.functions.balanceOf(
				queryManagerContract.address
			);
			// stake
			const stakeTx = await queryManagerContract
				.connect(activeUser)
				.functions.stake(stakeAmount);
			// fetch the event emmitted
			const event = await fetchEventArgsFromTx(
				stakeTx,
				QUERY_MANAGER_EVENTS.STAKE
			);

			// validate the event parameters
			expect(event?.consumer).to.equal(CONSUMER_ADDRESS);
			expect(+event?.amount).to.equal(+stakeAmount);

			const [userBalance] = await queryManagerContract.functions.balanceOf(
				activeUser.address
			);

			const [contractPostStakeBalance] = await ercToken.functions.balanceOf(
				queryManagerContract.address
			);
			expect(userBalance).equal(contractPostStakeBalance);

			expect(contractPostStakeBalance).to.be.greaterThanOrEqual(
				contractPreStakeBalance
			);
		});
	});
});
