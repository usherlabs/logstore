import { Wallet } from 'ethers';
import hre, { ethers } from 'hardhat';

import {
	getNodeManagerInputParameters,
	getQueryManagerInputParameters,
	getReportBlockBuffer,
	getStoreManagerInputParameters,
	writeJSONToFileOutside,
} from '../utils/functions';

function createPK(index: number, prefix: string) {
	const hexString = index.toString(16);
	return '0x' + prefix + hexString.padStart(64 - prefix.length, '0');
}

async function main() {
	// --------------------------- deploy the dev DATA token contract --------------------------- //
	let devTokenAddress = '';
	if ([5, 8997].includes(hre.network.config.chainId || 0)) {
		const devTokenArtifact = await hre.ethers.getContractFactory('DevToken');
		const devTokenDeployTx = await devTokenArtifact.deploy();
		await devTokenDeployTx.deployed();
		devTokenAddress = devTokenDeployTx.address;

		console.log(`DevToken deployed to ${devTokenAddress}`);
	}

	// --------------------------- deploy the node manager contract --------------------------- //
	const nodeManagerContractParams = await getNodeManagerInputParameters(
		devTokenAddress
	);
	const nodeManagerArtifact = await hre.ethers.getContractFactory(
		'LogStoreNodeManager'
	);
	const nodeManagerContract = await hre.upgrades.deployProxy(
		nodeManagerArtifact,
		nodeManagerContractParams
	);
	await nodeManagerContract.deployed();
	const { address: nodeManagerAddress } = nodeManagerContract;
	console.log(`LogStoreNodeManager deployed to ${nodeManagerAddress}`);
	// --------------------------- deploy the node manager contract --------------------------- //

	// --------------------------- deploy the store manager --------------------------- //
	const storeManagerContractParams = await getStoreManagerInputParameters(
		nodeManagerAddress
	);
	const storeManagerArtifact = await hre.ethers.getContractFactory(
		'LogStoreManager'
	);
	const storeManagerContract = await hre.upgrades.deployProxy(
		storeManagerArtifact,
		storeManagerContractParams
	);
	await storeManagerContract.deployed();
	const { address: storeManagerAddress } = storeManagerContract;
	console.log(`LogStoreStoreManager deployed to ${storeManagerAddress}`);
	// --------------------------- deploy the store manager --------------------------- //

	// --------------------------- deploy the query manager contract --------------------------- //
	const queryManagerContractParams = await getQueryManagerInputParameters(
		nodeManagerAddress
	);
	const queryManagerArtifact = await hre.ethers.getContractFactory(
		'LogStoreQueryManager'
	);
	const queryManagerContract = await hre.upgrades.deployProxy(
		queryManagerArtifact,
		queryManagerContractParams
	);
	await queryManagerContract.deployed();
	const { address: queryManagerAddress } = queryManagerContract;
	console.log(`LogStoreQueryManager deployed to ${queryManagerAddress}`);
	// --------------------------- deploy the query manager contract --------------------------- //

	// --------------------------- deploy the report manager contract --------------------------- //
	// Get block time of chain id
	const reportBlockBuffer = await getReportBlockBuffer();
	const Lib = await hre.ethers.getContractFactory('VerifySignature');
	const lib = await Lib.deploy();
	await lib.deployed();
	// deploy contract
	const reportManager = await hre.ethers.getContractFactory(
		'LogStoreReportManager',
		{
			libraries: {
				VerifySignature: lib.address,
			},
		}
	);
	const reportManagerContract = await hre.upgrades.deployProxy(
		reportManager,
		[nodeManagerAddress, reportBlockBuffer],
		{
			unsafeAllowLinkedLibraries: true,
		}
	);
	await reportManagerContract.deployed();
	const { address: reportManagerAddress } = reportManagerContract;
	console.log(`LogStoreReportManager deployed to ${reportManagerAddress}`, {
		nodeManagerAddress,
		reportBlockBuffer,
	});
	// --------------------------- deploy the query manager contract --------------------------- //

	// --------------------------- deploy the LSAN token
	const tokenManager = await hre.ethers.getContractFactory('LSAN');
	const WHITELISTED_ADDRESSES = [
		storeManagerAddress,
		reportManagerAddress,
		nodeManagerAddress,
	];
	const SAFE_ADDRESS = storeManagerAddress;
	const tokenManagerContract = await hre.upgrades.deployProxy(tokenManager, [
		WHITELISTED_ADDRESSES,
		SAFE_ADDRESS,
		nodeManagerAddress,
	]);
	await tokenManagerContract.deployed();

	const tokenManagerAddress = tokenManagerContract.address;
	console.log(`tokenManagerAddress deployed to ${tokenManagerAddress}`, {
		WHITELISTED_ADDRESSES,
		SAFE_ADDRESS,
		nodeManagerAddress,
	});
	// --------------------------- deploy the LSAN token

	// --------------------------- mint dev token to the test accounts ------------------------- //
	if ([5, 8997].includes(hre.network.config.chainId || 0)) {
		const devTokenArtifact = await hre.ethers.getContractFactory('DevToken');
		const token = await devTokenArtifact.attach(devTokenAddress);

		const wallets: string[] = [];
		const ACCOUNT_PK_PREFIX = '';
		const BROKER_PK_PREFIX = 'bb';
		const NUM_ACCOUNTS = 1000;
		const NUM_BROKERS = 3;
		const NUM_ACCOUNTS_IN_BATCH = 250;

		console.log(
			`Minting DevToken to ${NUM_ACCOUNTS} test accounts with Primary Keys:`
		);
		console.log('from: ', createPK(1, ACCOUNT_PK_PREFIX));
		console.log('to: ', createPK(NUM_ACCOUNTS, ACCOUNT_PK_PREFIX));
		console.log(`Minting...`);
		for (let accountIndex = 1; accountIndex <= NUM_ACCOUNTS; accountIndex++) {
			const privkey = createPK(accountIndex, ACCOUNT_PK_PREFIX);
			wallets.push(new Wallet(privkey).address);

			// Call mintMany with batches to speed up the process and not exceed the gas limit.
			if (
				accountIndex === NUM_ACCOUNTS ||
				wallets.length === NUM_ACCOUNTS_IN_BATCH
			) {
				await (await token.mintMany(wallets)).wait();
				wallets.splice(0);
				console.log(
					`Minted to ${accountIndex} accounts out of ${NUM_ACCOUNTS}`
				);
			}
		}

		console.log(
			`Minting native token and DevToken to ${NUM_BROKERS} broker accounts with Primary Keys:`
		);
		console.log('from: ', createPK(1, BROKER_PK_PREFIX));
		console.log('to: ', createPK(NUM_BROKERS, BROKER_PK_PREFIX));
		console.log(`Minting...`);
		const [signer] = await hre.ethers.getSigners();
		for (let accountIndex = 1; accountIndex <= NUM_BROKERS; accountIndex++) {
			const privkey = createPK(accountIndex, BROKER_PK_PREFIX);
			const address = new Wallet(privkey).address;
			wallets.push(address);

			const tx = {
				to: address,
				value: hre.ethers.utils.parseEther('1'),
			};
			await (await signer.sendTransaction(tx)).wait();

			// Call mintMany with batches to speed up the process and not exceed the gas limit.
			if (
				accountIndex === NUM_BROKERS ||
				wallets.length === NUM_ACCOUNTS_IN_BATCH
			) {
				await (await token.mintMany(wallets)).wait();
				wallets.splice(0);
				console.log(`Minted to ${accountIndex} accounts out of ${NUM_BROKERS}`);
			}
		}
	}
	// --------------------------- mint dev token to the test accounts ------------------------- //

	// --------------------------- write addresses to file --------------------------- //
	// initialise nodemanager contract with sub contracts
	const registerQueryManagerTx =
		await nodeManagerContract.functions.registerQueryManager(
			queryManagerAddress
		);
	await registerQueryManagerTx.wait();

	const registerStoreManagerTx =
		await nodeManagerContract.functions.registerStoreManager(
			storeManagerAddress
		);
	await registerStoreManagerTx.wait();

	const registerReportManagerTx =
		await nodeManagerContract.functions.registerReportManager(
			reportManagerAddress
		);
	await registerReportManagerTx.wait();
	// ?add some initial values to enable price information
	const INITIAL_MATIC_PER_BYTE = ethers.utils.parseEther('0.0000001');
	const TOTAL_BYTES_STORED = 10;
	const bytesMaticTx = await tokenManagerContract.functions.setMaticPerByte(
		INITIAL_MATIC_PER_BYTE
	);
	await bytesMaticTx.wait();
	const bytesStoredTx =
		await tokenManagerContract.functions.setTotalBytesStored(
			TOTAL_BYTES_STORED
		);
	await bytesStoredTx.wait();
	// ?add some initial values to enable price information

	const deployedContractAddresses = {
		devTokenAddress,
		nodeManagerAddress,
		storeManagerAddress,
		queryManagerAddress,
		reportManagerAddress,
		tokenManagerAddress,
	};
	// write the file to json
	await writeJSONToFileOutside(deployedContractAddresses, 'address.json');
	// --------------------------- write addresses to file --------------------------- //
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
