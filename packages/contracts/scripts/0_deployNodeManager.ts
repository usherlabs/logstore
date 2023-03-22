import hre from 'hardhat';

import {
	getNodeManagerInputParameters,
	getQueryManagerInputParameters,
	getStoreManagerInputParameters,
	writeJSONToFileOutside,
} from '../utils/functions';

async function main() {
	const nodeManagerContractParams = await getNodeManagerInputParameters();

	// --------------------------- deploy the node manager contract --------------------------- //
	const nodeManagerArtifact = await hre.ethers.getContractFactory(
		'LogStoreNodeManager'
	);
	const { address: nodeManagerAddress } = await hre.upgrades.deployProxy(
		nodeManagerArtifact,
		nodeManagerContractParams
	);
	// --------------------------- deploy the node manager contract --------------------------- //

	// --------------------------- deploy the store manager --------------------------- //
	const storeManagerContractParams = await getStoreManagerInputParameters(
		nodeManagerAddress
	);
	const storeManagerArtifact = await hre.ethers.getContractFactory(
		'LogStoreManager'
	);
	const { address: storeManagerAddress } = await hre.upgrades.deployProxy(
		storeManagerArtifact,
		storeManagerContractParams
	);
	// --------------------------- deploy the store manager --------------------------- //

	// --------------------------- deploy the query manager contract --------------------------- //
	const queryManagerContractParams = await getQueryManagerInputParameters(
		nodeManagerAddress
	);
	const queryManagerArtifact = await hre.ethers.getContractFactory(
		'LogStoreQueryManager'
	);
	const { address: queryManagerAddress } = await hre.upgrades.deployProxy(
		queryManagerArtifact,
		queryManagerContractParams
	);
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
	const { address: reportManagerAddress } = await hre.upgrades.deployProxy(
		reportManager,
		[nodeManagerAddress],
		{ unsafeAllowLinkedLibraries: true }
	);
	// --------------------------- deploy the query manager contract --------------------------- //

	// --------------------------- deploy the query manager contract --------------------------- //
	const deployedContractAddresses = {
		nodeManagerAddress,
		storeManagerAddress,
		queryManagerAddress,
		reportManagerAddress,
	};
	// write the file to json
	await writeJSONToFileOutside(deployedContractAddresses, 'address.json');
	// write files to console
	console.log(`LogStoreNodeManager deployed to ${nodeManagerAddress}`);
	console.log(`LogStoreStoreManager deployed to ${storeManagerAddress}`);
	console.log(`LogStoreQueryManager deployed to ${queryManagerAddress}`);
	console.log(`LogStoreReportanager deployed to ${reportManagerAddress}`);
	// --------------------------- deploy the query manager contract --------------------------- //
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
