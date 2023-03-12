import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { Contract } from 'ethers';
import { ethers } from 'hardhat';

import {
	CONSUMER_ADDRESS,
	CUSTOM_EXCEPTIONS,
	QUERY_MANAGER_EVENTS,
	SAMPLE_STREAM_ID,
} from './utils/constants';
import {
	fetchEventArgsFromTx,
	getDecimalBN,
	getERC20Token,
	loadQueryManager,
} from './utils/functions';

describe('QueryManager', async function () {
	let adminSigner: SignerWithAddress;
	let otherSigners: SignerWithAddress[];
	let queryManagerContract: Contract;

	beforeEach(async () => {
		[adminSigner, ...otherSigners] = await ethers.getSigners();
		queryManagerContract = await loadQueryManager(adminSigner);
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
				.functions.stake(SAMPLE_STREAM_ID, stakeAmount);
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
				.functions.stake(SAMPLE_STREAM_ID, stakeAmount);
			// fetch the event emmitted
			const event = await fetchEventArgsFromTx(
				stakeTx,
				QUERY_MANAGER_EVENTS.STAKE
			);

			// validate the event parameters
			expect(event?.consumer).to.equal(CONSUMER_ADDRESS);
			expect(event?.stream).to.equal(SAMPLE_STREAM_ID);
			expect(+event?.amount).to.equal(+stakeAmount);

			// fetch state from the contract to validate
			const [streamBalance] = await queryManagerContract.functions.stores(
				SAMPLE_STREAM_ID
			);
			const [userBalance] = await queryManagerContract.functions.balanceOf(
				activeUser.address
			);
			const [storeUserBalance] =
				await queryManagerContract.functions.storeBalanceOf(
					activeUser.address,
					SAMPLE_STREAM_ID
				);
			const [contractPostStakeBalance] = await ercToken.functions.balanceOf(
				queryManagerContract.address
			);
			expect(streamBalance)
				.to.equal(userBalance)
				.to.equal(storeUserBalance)
				.equal(contractPostStakeBalance);

			expect(contractPostStakeBalance).to.be.greaterThanOrEqual(
				contractPreStakeBalance
			);
		});
	});
});
