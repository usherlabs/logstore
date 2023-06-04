import { expect } from 'chai';
import { Contract, ethers, Signer } from 'ethers';
import { ethers as hEthers, network, upgrades } from 'hardhat';

const FAKE_NODE_MANAGER_CONTRACT = '0x325050796C56742c85D3E892e70EE7e4129Fb312';
const SAFE_ADDRESS = '0x325050796C56742c85D3E892e70EE7e4129Fb312';
const INITIAL_WHITELIST = [
	FAKE_NODE_MANAGER_CONTRACT,
	'0x02b24AC2239b344FbC4577801f7000901E7a3944',
];

describe('LSAN Token', function () {
	let lsan: Contract;
	let allSigners: Signer[];
	let allAccounts: string[];
	let adminSigner: Signer;
	let adminAddress: string;
	beforeEach(async () => {
		allSigners = await hEthers.getSigners();
		[adminSigner] = allSigners;
		const tokenContractFactory = await hEthers.getContractFactory(
			'LSAN',
			adminSigner
		);
		adminAddress = await adminSigner.getAddress();
		allAccounts = await Promise.all(allSigners.map((a) => a.getAddress()));
		lsan = await upgrades.deployProxy(tokenContractFactory, [
			SAFE_ADDRESS,
			[...INITIAL_WHITELIST, allAccounts[1], allAccounts[2]],
		]);

		// Wait for n blocks to be mined
		const nBlocks = 20; // Number of blocks to wait
		for (let i = 0; i < nBlocks; i++) {
			await network.provider.send('evm_mine');
		}
	});

	describe('Deployment', function () {
		it('should set the correct owner', async function () {
			expect(await lsan.owner()).to.equal(adminAddress);
		});

		it('should set the correct initial values', async function () {
			expect(await lsan.totalSupply()).to.equal(hEthers.BigNumber.from(0));
			expect(await lsan.maticPerByte()).to.equal(hEthers.BigNumber.from(0));
			expect(await lsan.totalBytesStored()).to.equal(hEthers.BigNumber.from(0));
			expect(await lsan.multiplier()).to.equal(hEthers.BigNumber.from(1));
			expect(await lsan.minimumDeposit()).to.equal(hEthers.BigNumber.from(0));
			expect(await lsan.balance()).to.equal(hEthers.BigNumber.from(0));
		});
	});

	describe('Minting', function () {
		it('Admin should mint tokens correctly', async function () {
			const amountToMint = hEthers.utils.parseEther('10');
			await lsan.mintTokens(allAccounts[1], amountToMint);

			const balance = await lsan.balanceOf(allAccounts[1]);
			expect(balance).to.equal(amountToMint);

			const totalSupply = await lsan.totalSupply();
			expect(totalSupply).to.equal(amountToMint);
		});

		it('should calculate minting correctly', async function () {
			const maticPerByte = hEthers.utils.parseEther('0.0000001');
			await lsan.setMaticPerByte(maticPerByte);

			const totalBytesStored = 10;
			await lsan.setTotalBytesStored(totalBytesStored);

			const multiplier = 1;
			await lsan.setMultipler(multiplier);

			const minimumDeposit = hEthers.utils.parseEther('1');
			await lsan.setMinimumDeposit(minimumDeposit);

			const amountSent = hEthers.utils.parseEther('100');
			await lsan.mint({ value: amountSent });

			// getting timestamp
			const blockNumBefore = await hEthers.provider.getBlockNumber();
			const blockBefore = await hEthers.provider.getBlock(blockNumBefore);
			const timestampBefore = blockBefore.timestamp;
			const totalExpense = maticPerByte.mul(totalBytesStored);
			const timeSinceStart = timestampBefore - (await lsan.DEPLOYED_TIME());
			const totalExpensePerDay = totalExpense.div(
				timeSinceStart * 86400 * 1000
			);
			const lsanPrice = totalExpensePerDay.mul(multiplier);
			const expectedMintAmount = amountSent.div(lsanPrice);

			const balance = await lsan.balanceOf(adminAddress);

			expect(balance).to.equal(expectedMintAmount);
		});
	});

	describe('Token Transfer', function () {
		it('should transfer tokens correctly', async function () {
			const amountToMint = hEthers.utils.parseEther('10');
			await lsan.mintTokens(allAccounts[1], amountToMint);

			const amountToTransfer = hEthers.utils.parseEther('5');
			await lsan
				.connect(allSigners[1])
				.transfer(allAccounts[2], amountToTransfer);

			const balance1 = await lsan.balanceOf(allAccounts[1]);
			const balance2 = await lsan.balanceOf(allAccounts[2]);

			expect(balance1).to.equal(amountToMint.sub(amountToTransfer));
			expect(balance2).to.equal(amountToTransfer);
		});

		it('should not allow transfers from non-whitelisted senders', async function () {
			// await lsan.whitelistTransferTo(allAccounts[1]);

			const amountToMint = ethers.utils.parseEther('10');
			await lsan.mintTokens(allAccounts[3], amountToMint);

			await expect(
				lsan
					.connect(allSigners[3])
					.transfer(allAccounts[1], ethers.utils.parseEther('5'))
			).to.be.revertedWith('User is not whitelisted to transfer tokens');

			const balance1 = await lsan.balanceOf(allAccounts[1]);
			const balance2 = await lsan.balanceOf(allAccounts[3]);

			expect(balance1).to.equal(ethers.BigNumber.from(0));
			expect(balance2).to.equal(amountToMint);
		});

		it('should allow transfers only from whitelisted senders', async function () {
			const transferAmount = ethers.utils.parseEther('5');
			// await lsan.whitelistTransferTo(allAccounts[1]);

			const amountToMint = ethers.utils.parseEther('10');
			await lsan.mintTokens(allAccounts[1], amountToMint);

			await lsan
				.connect(allSigners[1])
				.transfer(FAKE_NODE_MANAGER_CONTRACT, transferAmount);

			const balance1 = await lsan.balanceOf(allAccounts[1]);
			const balance2 = await lsan.balanceOf(FAKE_NODE_MANAGER_CONTRACT);

			expect(balance1).to.equal(amountToMint.sub(transferAmount));
			expect(balance2).to.equal(transferAmount);
		});

		it('should not allow transferFrom only unwhitelisted recipients', async function () {
			const amountToMint = ethers.utils.parseEther('10');
			await lsan.mintTokens(allAccounts[1], amountToMint);
			await lsan.approve(allAccounts[4], amountToMint);

			await expect(
				lsan
					.connect(allSigners[4])
					.transferFrom(
						allAccounts[4],
						FAKE_NODE_MANAGER_CONTRACT,
						amountToMint
					)
			).to.be.revertedWith('User is not whitelisted to transfer tokens');

			const balance1 = await lsan.balanceOf(allAccounts[1]);
			const balance2 = await lsan.balanceOf(allAccounts[3]);

			expect(balance1).to.equal(amountToMint);
			expect(balance2).to.equal(ethers.BigNumber.from(0));
		});

		it('should allow transferFrom only whitelisted recipients', async function () {
			await lsan.whitelistTransferFrom(adminAddress);

			const amountToMint = ethers.utils.parseEther('10');
			await lsan.mintTokens(adminAddress, amountToMint);
			await lsan.approve(allAccounts[3], amountToMint);

			await lsan
				.connect(allSigners[3])
				.transferFrom(adminAddress, FAKE_NODE_MANAGER_CONTRACT, amountToMint);

			const balance2 = await lsan.balanceOf(FAKE_NODE_MANAGER_CONTRACT);

			// expect(balance1).to.equal(0);
			expect(balance2).to.equal(amountToMint);
		});
	});

	describe('Whitelisting', function () {
		it('should whitelist senders correctly', async function () {
			await lsan.whitelistTransferTo(allAccounts[5]);

			expect(await lsan.transferToWhitelist(allAccounts[1])).to.be.true;
			expect(await lsan.transferToWhitelist(allAccounts[5])).to.be.true;
			expect(await lsan.transferToWhitelist(allAccounts[7])).to.be.false;
		});

		it('should whitelist recipients correctly', async function () {
			await lsan.whitelistTransferFrom(allAccounts[6]);

			expect(await lsan.transferFromWhitelist(allAccounts[1])).to.be.true;
			expect(await lsan.transferFromWhitelist(allAccounts[6])).to.be.true;
			expect(await lsan.transferFromWhitelist(allAccounts[7])).to.be.false;
		});
	});

	describe('Owner Functions', function () {
		it('admin can withdraw funds correctly', async function () {
			const maticPerByte = hEthers.utils.parseEther('0.0000001');
			await lsan.setMaticPerByte(maticPerByte);

			const totalBytesStored = 10;
			await lsan.setTotalBytesStored(totalBytesStored);

			const multiplier = 1;
			await lsan.setMultipler(multiplier);

			const minimumDeposit = hEthers.utils.parseEther('1');
			await lsan.setMinimumDeposit(minimumDeposit);

			const amountSent = hEthers.utils.parseEther('100');
			await lsan.mint({ value: amountSent });

			await lsan.withdraw(amountSent);
			const safeBalance = await hEthers.provider.getBalance(SAFE_ADDRESS);

			expect(safeBalance).to.equal(amountSent);
		});
	});
});
