import hre from 'hardhat';

import {
	getNodeManagerInputParameters,
	getStoreManagerInputParameters,
} from '../utils/functions';

async function main() {
	const nodeManagerContractParams = await getNodeManagerInputParameters();

	// deploy the node manager contract
	const nodeManagerArtifact = await hre.ethers.getContractFactory(
		'LogStoreNodeManager'
	);
	const { address: nodeManagerAddress } = await hre.upgrades.deployProxy(
		nodeManagerArtifact,
		nodeManagerContractParams
	);
	// deploy the store manager
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

	console.log(`LogStoreNodeManager deployed to ${nodeManagerAddress}`);
	console.log(`LogStoreStoreManager deployed to ${storeManagerAddress}`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
