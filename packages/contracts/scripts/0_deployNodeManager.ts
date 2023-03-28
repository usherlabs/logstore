import hre from 'hardhat';

import {
	getNodeManagerInputParameters,
	getQueryManagerInputParameters,
	getStoreManagerInputParameters,
	writeJSONToFileOutside,
} from '../utils/functions';

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
		[nodeManagerAddress],
		{
			unsafeAllowLinkedLibraries: true,
		}
	);
	await reportManagerContract.deployed();
	const { address: reportManagerAddress } = reportManagerContract;
	console.log(`LogStoreReportanager deployed to ${reportManagerAddress}`);
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

	const registerReportManagerTx =
		await nodeManagerContract.functions.registerReportManager(
			reportManagerAddress
		);
	await registerReportManagerTx.wait();

	const deployedContractAddresses = {
		devTokenAddress,
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
