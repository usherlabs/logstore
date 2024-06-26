import { Contract, Wallet } from 'ethers';
import hre from 'hardhat';

import {
	getNodeManagerInputParameters,
	getQueryManagerInputParameters,
	getStoreManagerInputParameters,
	getWeiPerByte,
	writeJSONToFileOutside,
} from '../utils/functions';

function createPK(index: number, prefix: string) {
	const hexString = index.toString(16);
	return '0x' + prefix + hexString.padStart(64 - prefix.length, '0');
}

const SAFE_ADDRESS: string =
	process.env.SAFE_ADDRESS || '0x468e80b73192998C565cFF53B1Dc02a12d5685c4'; // for MATIC Only
// const forceLSANToken = process.env.FORCE_LSAN_TOKEN === 'true';

async function main() {
	const [signer] = await hre.ethers.getSigners();

	// --------------------------- deploy the LSAN token
	let tokenManagerContract: Contract;
	let tokenManagerAddress: string = '';
	const tokenManager = await hre.ethers.getContractFactory('LSAN');
	const safeAddress =
		hre.network.config.chainId === 137 // Polygon
			? SAFE_ADDRESS
			: signer.address;
	console.log('Starting the LSAN deployment...');
	while (!tokenManagerAddress) {
		try {
			const weiPerByte =
				hre.network.config.chainId === 31337 // DevNetwork
					? hre.ethers.utils.parseUnits('1000000000', 'wei')
					: await getWeiPerByte();

			console.log('Wei Per Byte:', weiPerByte.toNumber());
			console.log('MATIC Per Byte:', hre.ethers.utils.formatEther(weiPerByte));
			tokenManagerContract = await hre.upgrades.deployProxy(tokenManager, [
				safeAddress,
				weiPerByte,
				[],
				[],
			]);
			await tokenManagerContract.deployed();
			tokenManagerAddress = tokenManagerContract.address;
			console.log(`tokenManagerAddress deployed to ${tokenManagerAddress}`, {
				safeAddress,
			});
		} catch (e) {
			// Handle error on contract deployment
			console.error(e);
			console.log('\n Trying LSAN deployment again...');
		}
	}
	// --------------------------- deploy the LSAN token

	// --------------------------- deploy the node manager contract --------------------------- //
	console.log('Using LSAN TOKEN token as Stake Token...');
	console.log('Starting the LogStoreNodeManager deployment...');
	const stakeTokenAddress = tokenManagerAddress;
	let nodeManagerContract: Contract;
	let nodeManagerAddress: string = '';
	while (!nodeManagerAddress) {
		try {
			const nodeManagerContractParams = await getNodeManagerInputParameters(
				stakeTokenAddress
			);
			const nodeManagerArtifact = await hre.ethers.getContractFactory(
				'LogStoreNodeManager'
			);
			nodeManagerContract = await hre.upgrades.deployProxy(
				nodeManagerArtifact,
				nodeManagerContractParams
			);
			await nodeManagerContract.deployed();
			nodeManagerAddress = nodeManagerContract.address;
			console.log(`LogStoreNodeManager deployed to ${nodeManagerAddress}`);
		} catch (e) {
			// Handle error on contract deployment
			console.error(e);
			console.log('\n Trying LogStoreNodeManager deployment again...');
		}
	}
	// --------------------------- deploy the node manager contract --------------------------- //

	// --------------------------- deploy the store manager --------------------------- //
	console.log('Starting the LogStoreManager deployment...');
	let storeManagerAddress: string = '';
	while (!storeManagerAddress) {
		try {
			const storeManagerContractParams = await getStoreManagerInputParameters(
				nodeManagerAddress,
				stakeTokenAddress
			);
			const storeManagerArtifact = await hre.ethers.getContractFactory(
				'LogStoreManager'
			);
			const storeManagerContract = await hre.upgrades.deployProxy(
				storeManagerArtifact,
				storeManagerContractParams
			);
			await storeManagerContract.deployed();
			storeManagerAddress = storeManagerContract.address;
			console.log(`LogStoreManager deployed to ${storeManagerAddress}`);
		} catch (e) {
			// Handle error on contract deployment
			console.error(e);
			console.log('\n Trying LogStoreManager deployment again...');
		}
	}
	// --------------------------- deploy the store manager --------------------------- //

	// --------------------------- deploy the query manager contract --------------------------- //
	console.log('Starting the LogStoreQueryManager deployment...');
	let queryManagerAddress: string = '';
	while (!queryManagerAddress) {
		try {
			const queryManagerContractParams = await getQueryManagerInputParameters(
				nodeManagerAddress,
				stakeTokenAddress
			);
			const queryManagerArtifact = await hre.ethers.getContractFactory(
				'LogStoreQueryManager'
			);
			const queryManagerContract = await hre.upgrades.deployProxy(
				queryManagerArtifact,
				queryManagerContractParams
			);
			await queryManagerContract.deployed();
			queryManagerAddress = queryManagerContract.address;
			console.log(`LogStoreQueryManager deployed to ${queryManagerAddress}`);
		} catch (e) {
			// Handle error on contract deployment
			console.error(e);
			console.log('\n Trying LogStoreQueryManager deployment again...');
		}
	}

	// --------------------------- deploy the query manager contract --------------------------- //

	// --------------------------- deploy the report manager contract --------------------------- //
	let verifySigLibDeployed = false;
	let verifySigLib: Contract;
	const reportTimeBuffer = 60 * 1000;
	while (!verifySigLibDeployed) {
		try {
			// Get block time of chain id
			const Lib = await hre.ethers.getContractFactory('VerifySignature');
			verifySigLib = await Lib.deploy();
			await verifySigLib.deployed();
			console.log(
				`VerifySignature Library deployed to ${verifySigLib.address}`
			);
			verifySigLibDeployed = true;
		} catch (e) {
			// Handle error on contract deployment
			console.error(e);
			console.log('\n Trying VerifySignature Library deployment again...');
		}
	}

	console.log('Starting the LogStoreReportManager deployment...');
	let reportManagerAddress: string = '';
	while (!reportManagerAddress) {
		try {
			const reportManager = await hre.ethers.getContractFactory(
				'LogStoreReportManager',
				{
					libraries: {
						VerifySignature: verifySigLib!.address,
					},
				}
			);
			const reportManagerContract = await hre.upgrades.deployProxy(
				reportManager,
				[signer.address, nodeManagerAddress, reportTimeBuffer, 0],
				{
					unsafeAllowLinkedLibraries: true,
				}
			);
			await reportManagerContract.deployed();
			reportManagerAddress = reportManagerContract.address;
			console.log(`LogStoreReportManager deployed to ${reportManagerAddress}`, {
				nodeManagerAddress,
				reportTimeBuffer,
			});
		} catch (e) {
			// Handle error on contract deployment
			console.error(e);
			console.log('\n Trying LogStoreReportManager deployment again...');
		}
	}
	// --------------------------- deploy the query manager contract --------------------------- //

	// --------------------------- mint dev token to the test accounts ------------------------- //
	if ([5, 31337].includes(hre.network.config.chainId || 0)) {
		console.log(
			'-------- !!! Performing DEV TOKEN minting process for TEST accounts...'
		);
		const token = await tokenManager.attach(stakeTokenAddress);

		const wallets: string[] = [];

		const MINT_AMOUNT = '1000000000000000000000000000000000000';
		const ACCOUNT_PK_PREFIX = '';
		const BROKER_PK_PREFIX = 'bb';
		const PULSE_PK =
			'1111111111111111111111111111111111111111111111111111111111111111';
		const STORAGE_PROXY_PK =
			'0000000000000000000000000000000000000000000000000000000000000111';
		const NUM_ACCOUNTS = 1000;
		const NUM_BROKERS = 10;
		const NUM_ACCOUNTS_IN_BATCH = 100;

		console.log();
		console.log(`Minting LSAN to 10 Streamr developer accounts`);
		console.log(`Minting...`);
		wallets.push(
			'0xa3d1F77ACfF0060F7213D7BF3c7fEC78df847De1',
			'0x4178baBE9E5148c6D5fd431cD72884B07Ad855a0',
			'0xdC353aA3d81fC3d67Eb49F443df258029B01D8aB',
			'0x7986b71C27B6eAAB3120a984F26511B2dcfe3Fb4',
			'0xa6743286b55F36AFA5F4e7e35B6a80039C452dBD',
			'0x7B556228B0D887CfC8d895cCe27CbC79d3e55b3C',
			'0x795063367EbFEB994445d810b94461274E4f109A',
			'0xcA9b39e7A7063cDb845483426D4f12F1f4A44A19',
			'0x505D48552Ac17FfD0845FFA3783C2799fd4aaD78',
			'0x65416CBeF822290d9A2FC319Eb6c7f6D9Cd4a541'
		);
		await (await token.mintManyTokens(wallets, MINT_AMOUNT)).wait();
		wallets.splice(0);

		console.log();
		console.log(
			`Minting LSAN to ${NUM_ACCOUNTS} test accounts with Primary Keys:`
		);
		console.log('from: ', createPK(1, ACCOUNT_PK_PREFIX));
		console.log('to: ', createPK(NUM_ACCOUNTS, ACCOUNT_PK_PREFIX));
		console.log(`Minting...`);
		for (let accountIndex = 1; accountIndex <= NUM_ACCOUNTS; accountIndex++) {
			const privkey = createPK(accountIndex, ACCOUNT_PK_PREFIX);
			wallets.push(new Wallet(privkey).address);

			// Call mintManyTokens with batches to speed up the process and not exceed the gas limit.
			if (
				accountIndex === NUM_ACCOUNTS ||
				wallets.length === NUM_ACCOUNTS_IN_BATCH
			) {
				await (await token.mintManyTokens(wallets, MINT_AMOUNT)).wait();
				wallets.splice(0);
				console.log(
					`Minted to ${accountIndex} accounts out of ${NUM_ACCOUNTS}`
				);
			}
		}

		console.log();
		console.log(
			`Minting native token and LSAN to ${NUM_BROKERS} broker accounts with Primary Keys:`
		);
		console.log('from: ', createPK(1, BROKER_PK_PREFIX));
		console.log('to: ', createPK(NUM_BROKERS, BROKER_PK_PREFIX));
		console.log(`Minting...`);
		for (let accountIndex = 1; accountIndex <= NUM_BROKERS; accountIndex++) {
			const privkey = createPK(accountIndex, BROKER_PK_PREFIX);
			const address = new Wallet(privkey).address;
			wallets.push(address);

			const tx = {
				to: address,
				value: hre.ethers.utils.parseEther('1'),
			};
			await (await signer.sendTransaction(tx)).wait();

			// Call mintManyTokens with batches to speed up the process and not exceed the gas limit.
			if (
				accountIndex === NUM_BROKERS ||
				wallets.length === NUM_ACCOUNTS_IN_BATCH
			) {
				const mintTx = await token.mintManyTokens(wallets, MINT_AMOUNT);
				await mintTx.wait();
				console.log(
					`Minted to ${accountIndex} accounts out of ${NUM_BROKERS}`,
					{ tx: mintTx.hash }
				);

				const whitelistTx =
					await tokenManagerContract!.functions.massAddWhitelist(
						wallets,
						wallets.map((_) => nodeManagerAddress)
					);
				await whitelistTx.wait();
				console.log(
					`Whitelisted ${accountIndex} accounts out of ${NUM_BROKERS}`,
					{ tx: whitelistTx.hash }
				);

				wallets.splice(0);
			}
		}

		// Pulse
		{
			console.log();
			console.log(
				`Minting native token and LSAN to the Pulse account with Primary Key: ${PULSE_PK}`
			);
			const address = new Wallet(PULSE_PK).address;

			const tx = {
				to: address,
				value: hre.ethers.utils.parseEther('1'),
			};
			await (await signer.sendTransaction(tx)).wait();
			await (await token.mintTokens(address, MINT_AMOUNT)).wait();
		}

		// Storage Proxy
		{
			console.log();
			console.log(
				`Minting native token and LSAN to the Storage Proxy account with Primary Key: ${STORAGE_PROXY_PK}`
			);
			const address = new Wallet(STORAGE_PROXY_PK).address;

			const tx = {
				to: address,
				value: hre.ethers.utils.parseEther('1'),
			};
			await (await signer.sendTransaction(tx)).wait();
			await (await token.mintTokens(address, MINT_AMOUNT)).wait();
		}
	}
	// --------------------------- mint dev token to the test accounts ------------------------- //

	// --------------------------- write addresses to file --------------------------- //
	// initialise nodemanager contract with sub contracts
	const registerQueryManagerTx =
		await nodeManagerContract!.functions.registerQueryManager(
			queryManagerAddress
		);
	await registerQueryManagerTx.wait();

	const registerStoreManagerTx =
		await nodeManagerContract!.functions.registerStoreManager(
			storeManagerAddress
		);
	await registerStoreManagerTx.wait();

	const registerReportManagerTx =
		await nodeManagerContract!.functions.registerReportManager(
			reportManagerAddress
		);
	await registerReportManagerTx.wait();

	// adjust initial values within AlphaNet TokenManager
	const blacklistTx = await tokenManagerContract!.functions.addBlacklist(
		nodeManagerAddress
	);
	await blacklistTx.wait();
	const whitelistTx = await tokenManagerContract!.functions.massAddWhitelist(
		[storeManagerAddress, queryManagerAddress],
		[nodeManagerAddress, nodeManagerAddress]
	);
	await whitelistTx.wait();

	console.log();
	console.log(`tokenManagerAddress blacklist/whitelist updated`, {
		blacklistTx: blacklistTx.hash,
		whitelistTx: whitelistTx.hash,
	});

	const deployedContractAddresses = {
		tokenManagerAddress,
		nodeManagerAddress,
		storeManagerAddress,
		queryManagerAddress,
		reportManagerAddress,
	};
	// write the file to json
	await writeJSONToFileOutside(deployedContractAddresses, 'address.json');
	// --------------------------- write addresses to file --------------------------- //
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
