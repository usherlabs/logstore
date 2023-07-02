import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { Contract } from 'ethers';
import { ethers } from 'hardhat';

import {
	CUSTOM_EXCEPTIONS,
	SAMPLE_STREAM_ID,
	STORE_MANAGER_EVENTS,
} from './utils/constants';
import {
	fetchEventArgsFromTx,
	getDecimalBN,
	getERC20Token,
	loadNodeManager,
	loadStoreManager,
} from './utils/functions';

describe('StoreManager', async function () {
	let adminSigner: SignerWithAddress;
	let otherSigners: SignerWithAddress[];
	let storeManagerContract: Contract;

	beforeEach(async () => {
		[adminSigner, ...otherSigners] = await ethers.getSigners();
		const nodeManagerContract = await loadNodeManager(adminSigner);
		storeManagerContract = await loadStoreManager(
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
			const stakeTx = storeManagerContract
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
				storeManagerContract.address
			);
			// stake
			const stakeTx = await storeManagerContract
				.connect(activeUser)
				.functions.stake(SAMPLE_STREAM_ID, stakeAmount);
			// fetch the event emmitted
			const event = await fetchEventArgsFromTx(
				stakeTx,
				STORE_MANAGER_EVENTS.STORE_UPDATED
			);

			// validate the event parameters
			expect(event?.store).to.equal(SAMPLE_STREAM_ID);
			expect(event?.isNew).to.equal(true);
			expect(+event?.amount).to.equal(+stakeAmount);

			// fetch state from the contract to validate
			const [streamBalance] = await storeManagerContract.functions.stores(
				SAMPLE_STREAM_ID
			);
			const [userBalance] = await storeManagerContract.functions.balanceOf(
				activeUser.address
			);
			const [storeUserBalance] =
				await storeManagerContract.functions.storeBalanceOf(
					activeUser.address,
					SAMPLE_STREAM_ID
				);
			const [contractPostStakeBalance] = await ercToken.functions.balanceOf(
				storeManagerContract.address
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
