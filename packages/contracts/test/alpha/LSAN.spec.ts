import { expect } from 'chai';
import { Contract, ethers, Signer } from 'ethers';
import { ethers as hEthers, network, upgrades } from 'hardhat';

const FAKE_NODE_MANAGER_CONTRACT = '0x325050796C56742c85D3E892e70EE7e4129Fb312';
const SAFE_ADDRESS = '0x325050796C56742c85D3E892e70EE7e4129Fb312';
const INITIAL_WHITELIST = ['0x02b24AC2239b344FbC4577801f7000901E7a3944'];
const WEI_PER_BYTE = 7681821032; // pnpm price

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
			WEI_PER_BYTE,
			[FAKE_NODE_MANAGER_CONTRACT], // A list of addresses that are whitelisted to send LSAN
			[INITIAL_WHITELIST],
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
			expect(await lsan.weiPerByte()).to.equal(
				hEthers.BigNumber.from(WEI_PER_BYTE)
			);
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
			const weiPerByte = hEthers.utils.parseEther('0.0000001');
			await lsan.setWeiPerByte(weiPerByte);

			const multiplier = 1;
			await lsan.setMultipler(multiplier);

			const minimumDeposit = hEthers.utils.parseEther('1');
			await lsan.setMinimumDeposit(minimumDeposit);

			const amountSent = hEthers.utils.parseEther('100');
			await lsan.mint({ value: amountSent });

			// getting timestamp
			const lsanPrice = +weiPerByte * multiplier;
			const expectedMintAmount = amountSent.div(lsanPrice);

			const balance = await lsan.balanceOf(adminAddress);

			expect(balance).to.equal(expectedMintAmount);
		});
	});

	describe('Token Transfer', function () {
		it('should transfer tokens correctly', async function () {
			const amountToMint = hEthers.utils.parseEther('10');
			await lsan.mintTokens(allAccounts[1], amountToMint); // will whitelist allAccounts[1] during the mint process
			await lsan.addWhitelist(allAccounts[1], allAccounts[2]);

			const amountToTransfer = hEthers.utils.parseEther('5');
			await lsan
				.connect(allSigners[1])
				.transfer(allAccounts[2], amountToTransfer);

			const balance1 = await lsan.balanceOf(allAccounts[1]);
			const balance2 = await lsan.balanceOf(allAccounts[2]);

			expect(balance1).to.equal(amountToMint.sub(amountToTransfer));
			expect(balance2).to.equal(amountToTransfer);
		});

		it('should not allow transfers to blacklisted addresses', async function () {
			const amountToMint = hEthers.utils.parseEther('10');
			await lsan.mintTokens(allAccounts[1], amountToMint);

			const amountToTransfer = hEthers.utils.parseEther('5');
			await expect(
				lsan
					.connect(allSigners[1])
					.transfer(FAKE_NODE_MANAGER_CONTRACT, amountToTransfer)
			).to.be.revertedWith('LSAN: Transfer between addresses is not permitted');

			const balance1 = await lsan.balanceOf(allAccounts[1]);
			const balance2 = await lsan.balanceOf(FAKE_NODE_MANAGER_CONTRACT);

			expect(balance1).to.equal(amountToMint);
			expect(balance2).to.equal(ethers.BigNumber.from(0));
		});

		it('should allow transfers with whitelist', async function () {
			const transferAmount = ethers.utils.parseEther('5');
			const amountToMint = ethers.utils.parseEther('10');
			await lsan.mintTokens(allAccounts[1], amountToMint);
			await lsan.addWhitelist(allAccounts[1], FAKE_NODE_MANAGER_CONTRACT);

			await lsan
				.connect(allSigners[1])
				.transfer(FAKE_NODE_MANAGER_CONTRACT, transferAmount);

			const balance1 = await lsan.balanceOf(allAccounts[1]);
			const balance2 = await lsan.balanceOf(FAKE_NODE_MANAGER_CONTRACT);

			expect(balance1).to.equal(amountToMint.sub(transferAmount));
			expect(balance2).to.equal(transferAmount);
		});

		it('should not allow transferFrom to blacklisted address', async function () {
			const amountToMint = ethers.utils.parseEther('10');
			await lsan.mintTokens(allAccounts[3], amountToMint);
			await lsan.connect(allSigners[3]).approve(allAccounts[4], amountToMint); // Approve allAccount[4] to transferFrom allAccount[3]

			await expect(
				lsan.connect(allSigners[4]).transferFrom(
					allAccounts[3],
					FAKE_NODE_MANAGER_CONTRACT, // Node Manager is not a recipient for allAccount[3]
					amountToMint
				)
			).to.be.revertedWith('LSAN: Transfer between addresses is not permitted');

			const balance1 = await lsan.balanceOf(allAccounts[3]);
			const balance2 = await lsan.balanceOf(FAKE_NODE_MANAGER_CONTRACT);

			expect(balance1).to.equal(amountToMint);
			expect(balance2).to.equal(ethers.BigNumber.from(0));
		});

		it('should allow transferFrom where whitelisted', async function () {
			const amountToMint = ethers.utils.parseEther('10');
			await lsan.mintTokens(allAccounts[3], amountToMint);
			await lsan.addWhitelist(allAccounts[3], FAKE_NODE_MANAGER_CONTRACT);
			await lsan.connect(allSigners[3]).approve(allAccounts[4], amountToMint); // Approve allAccount[4] to transferFrom allAccount[3]

			await lsan
				.connect(allSigners[4])
				.transferFrom(allAccounts[3], FAKE_NODE_MANAGER_CONTRACT, amountToMint);

			const balance1 = await lsan.balanceOf(allAccounts[3]);
			const balance2 = await lsan.balanceOf(FAKE_NODE_MANAGER_CONTRACT);

			expect(balance1).to.equal(ethers.BigNumber.from(0));
			expect(balance2).to.equal(amountToMint);
		});
	});

	describe('Whitelisting', function () {
		it('should whitelist correctly', async function () {
			expect(await lsan.isPermitted(allAccounts[5], FAKE_NODE_MANAGER_CONTRACT))
				.to.be.false;

			await lsan.addWhitelist(allAccounts[5], FAKE_NODE_MANAGER_CONTRACT);

			expect(await lsan.isPermitted(allAccounts[5], FAKE_NODE_MANAGER_CONTRACT))
				.to.be.true;
			expect(await lsan.isPermitted(allAccounts[5], allAccounts[7])).to.be.true;
		});

		it('should respect blacklist', async function () {
			const amountToMint = ethers.utils.parseEther('10');
			await lsan.mintTokens(allAccounts[6], amountToMint);

			expect(await lsan.isPermitted(allAccounts[6], allAccounts[7])).to.be.true;

			await lsan.addBlacklist(allAccounts[7]);

			expect(await lsan.isPermitted(allAccounts[6], allAccounts[7])).to.be
				.false;

			await lsan.addWhitelist(allAccounts[6], allAccounts[7]);

			expect(await lsan.isPermitted(allAccounts[6], allAccounts[7])).to.be.true;

			await lsan.removeWhitelist(allAccounts[6], allAccounts[7]);

			expect(await lsan.isPermitted(allAccounts[6], allAccounts[7])).to.be
				.false;
		});
	});

	describe('Owner Functions', function () {
		it('admin can withdraw funds correctly', async function () {
			const weiPerByte = hEthers.utils.parseEther('0.0000001');
			await lsan.setWeiPerByte(weiPerByte);

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
