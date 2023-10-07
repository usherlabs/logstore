import hre, { upgrades } from 'hardhat';

import contractAddresses from '../address.json';
import { getChainId } from '../utils/functions';

async function main() {
	const chainId = String(await getChainId()) as keyof typeof contractAddresses;

	// upgrade the token-manager contract
	const tokenManagerContract = await hre.ethers.getContractFactory('LSAN');
	const upgradedLockerContract = await upgrades.upgradeProxy(
		contractAddresses[chainId].tokenManagerAddress,
		tokenManagerContract
	);
	await upgradedLockerContract.deployed();
	console.log('sucesfully updated the tokenManagerContract');
	// upgrade the token-manager contract

	// upgrade the node-manager contract
	const nodeManagerContract = await hre.ethers.getContractFactory(
		'LogStoreNodeManager'
	);
	const upgradedNodeContract = await upgrades.upgradeProxy(
		contractAddresses[chainId].nodeManagerAddress,
		nodeManagerContract
	);
	await upgradedNodeContract.deployed();
	console.log('sucesfully updated the nodeManagerContract');
	// upgrade the node-manager contract

	// upgrade the store-manager contract
	const storeManagerContract = await hre.ethers.getContractFactory(
		'LogStoreManager'
	);
	const upgradedStoreContract = await upgrades.upgradeProxy(
		contractAddresses[chainId].storeManagerAddress,
		storeManagerContract
	);
	await upgradedStoreContract.deployed();
	console.log('sucesfully updated the storeManagerContract');
	// upgrade the store-manager contract

	// upgrade the query-manager contract
	const queryManagerContract = await hre.ethers.getContractFactory(
		'LogStoreQueryManager'
	);
	const upgradedQueryContract = await upgrades.upgradeProxy(
		contractAddresses[chainId].queryManagerAddress,
		queryManagerContract
	);
	await upgradedQueryContract.deployed();
	console.log('sucesfully updated the queryManagerContract');
	// upgrade the query-manager contract

	// upgrade the report-manager contract
	const Lib = await hre.ethers.getContractFactory('VerifySignature');
	const lib = await Lib.deploy();
	await lib.deployed();

	const reportManagerContract = await hre.ethers.getContractFactory(
		'LogStoreReportManager',
		{
			libraries: {
				VerifySignature: lib.address,
			},
		}
	);
	const upgradedReportContract = await upgrades.upgradeProxy(
		contractAddresses[chainId].reportManagerAddress,
		reportManagerContract,
		{ unsafeAllowLinkedLibraries: true }
	);
	await upgradedReportContract.deployed();
	console.log('sucesfully updated the reportManagerContract');
	// upgrade the report-manager contract

	console.log(
		'---------------- sucesfully updated all contracts --------------'
	);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
