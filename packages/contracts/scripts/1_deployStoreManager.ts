import hre from 'hardhat';

import ContractAddresses from '../address.json';
import {
	getQueryManagerInputParameters,
	getStoreManagerInputParameters,
	writeJSONToFileOutside,
} from '../utils/functions';

const SAFE_ADDRESS: string =
	process.env.SAFE_ADDRESS || '0x468e80b73192998C565cFF53B1Dc02a12d5685c4'; // for MATIC Only
// const forceLSANToken = process.env.FORCE_LSAN_TOKEN === 'true';

// ! BUG on old deploy script caused incorrect stake token to be used.

async function main() {
	// --------------------------- deploy the LSAN token
	const chainId = hre.network.config.chainId;
	console.log('Chain Id:', chainId);
	const chainIdIndex = `${chainId}` as keyof typeof ContractAddresses;
	const { tokenManagerAddress, nodeManagerAddress, reportManagerAddress } =
		ContractAddresses[chainIdIndex] as any;
	const tokenManager = await hre.ethers.getContractFactory('LSAN');
	const tokenManagerContract = tokenManager.attach(tokenManagerAddress);
	// --------------------------- deploy the LSAN token

	// --------------------------- deploy the node manager contract --------------------------- //
	const stakeTokenAddress = tokenManagerAddress;
	const nodeManagerArtifact = await hre.ethers.getContractFactory(
		'LogStoreNodeManager'
	);
	const nodeManagerContract = nodeManagerArtifact.attach(nodeManagerAddress);
	console.log(`LogStoreNodeManager attached to ${nodeManagerAddress}`);
	// --------------------------- deploy the node manager contract --------------------------- //

	// --------------------------- deploy the store manager --------------------------- //
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
	const { address: storeManagerAddress } = storeManagerContract;
	console.log(`LogStoreStoreManager deployed to ${storeManagerAddress}`);
	// --------------------------- deploy the store manager --------------------------- //

	// --------------------------- deploy the query manager contract --------------------------- //
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
	const { address: queryManagerAddress } = queryManagerContract;
	console.log(`LogStoreQueryManager deployed to ${queryManagerAddress}`);
	// --------------------------- deploy the query manager contract --------------------------- //

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

	// adjust initial values within AlphaNet TokenManager
	const blacklistTx = await tokenManagerContract.functions.addBlacklist(
		nodeManagerAddress
	);
	await blacklistTx.wait();
	const whitelistTx = await tokenManagerContract.functions.massAddWhitelist(
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
