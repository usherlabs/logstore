/**
 * ! Deployment script failed on 30th of Oct as the store, query and report manager all returned the same address.
 */
import hre from 'hardhat';

import {
	getQueryManagerInputParameters,
	getStoreManagerInputParameters,
	writeJSONToFileOutside,
} from '../utils/functions';

const SAFE_ADDRESS: string =
	process.env.SAFE_ADDRESS || '0x468e80b73192998C565cFF53B1Dc02a12d5685c4'; // for MATIC Only
// const forceLSANToken = process.env.FORCE_LSAN_TOKEN === 'true';

async function main() {
	const [signer] = await hre.ethers.getSigners();

	const tokenManagerAddress = '0x365Bdc64E2aDb50E43E56a53B7Cc438d48D0f0DD';
	const nodeManagerAddress = '0xeb21022d952e5De09C30bfda9E6352FFA95F67bE';
	const verifySigLibAddress = '0x21Fe01489651157a92F618B6A1Cf652EaB482547';

	console.log(
		`Starting with ${JSON.stringify({
			tokenManagerAddress,
			nodeManagerAddress,
			verifySigLibAddress,
		})}`
	);

	// --------------------------- deploy the LSAN token
	const tokenManagerContract = await hre.ethers.getContractAt(
		'LSAN',
		tokenManagerAddress,
		signer
	);
	// --------------------------- deploy the LSAN token

	// --------------------------- deploy the node manager contract --------------------------- //
	const nodeManagerContract = await hre.ethers.getContractAt(
		'LogStoreNodeManager',
		nodeManagerAddress,
		signer
	);
	// --------------------------- deploy the node manager contract --------------------------- //

	// --------------------------- deploy the store manager --------------------------- //
	const stakeTokenAddress = tokenManagerAddress;

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
	const reportTimeBuffer = 60 * 1000;
	console.log('Starting the LogStoreReportManager deployment...');
	let reportManagerAddress: string = '';
	while (!reportManagerAddress) {
		try {
			const reportManager = await hre.ethers.getContractFactory(
				'LogStoreReportManager',
				{
					libraries: {
						VerifySignature: verifySigLibAddress,
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
