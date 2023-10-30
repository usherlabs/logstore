/**
 * ! Deployment script failed on 30th of Oct as the store, query and report manager all returned the same address.
 * Needed to pass signer to `getContractAt`
 */
import hre from 'hardhat';

import { writeJSONToFileOutside } from '../utils/functions';

const SAFE_ADDRESS: string =
	process.env.SAFE_ADDRESS || '0x468e80b73192998C565cFF53B1Dc02a12d5685c4'; // for MATIC Only
// const forceLSANToken = process.env.FORCE_LSAN_TOKEN === 'true';

async function main() {
	const [signer] = await hre.ethers.getSigners();

	const tokenManagerAddress = '0xceb09e8cfc96dd0ea9081c4cfa7092c06153461a';
	const nodeManagerAddress = '0xeb21022d952e5De09C30bfda9E6352FFA95F67bE';
	const verifySigLibAddress = '0x21Fe01489651157a92F618B6A1Cf652EaB482547';
	const storeManagerAddress = '0x2d3E079B3329baF96DFb6eB176D41a6D894E388e';
	const queryManagerAddress = '0x37444ddbfcE5Ab8622735A6F4a4a46a9e9dA78f9';
	const reportManagerAddress = '0x8cF286229AEa248Ea4a13D2C5df071C6482488b5';

	console.log(
		`Starting with ${JSON.stringify({
			tokenManagerAddress,
			nodeManagerAddress,
			verifySigLibAddress,
			storeManagerAddress,
			queryManagerAddress,
			reportManagerAddress,
		})}`
	);

	const tokenManagerContract = await hre.ethers.getContractAt(
		'LSAN',
		tokenManagerAddress
	);
	// const nodeManagerContract = await hre.ethers.getContractAt(
	// 	'LogStoreNodeManager',
	// 	nodeManagerAddress,
	// 	signer
	// );

	// --------------------------- write addresses to file --------------------------- //

	// initialise nodemanager contract with sub contracts
	// const registerQueryManagerTx =
	// 	await nodeManagerContract.functions.registerQueryManager(
	// 		queryManagerAddress
	// 	);
	// await registerQueryManagerTx.wait();

	// console.log('registerQueryManagerTx', registerQueryManagerTx);

	// const registerStoreManagerTx =
	// 	await nodeManagerContract.functions.registerStoreManager(
	// 		storeManagerAddress
	// 	);
	// await registerStoreManagerTx.wait();

	// console.log('registerStoreManagerTx', registerStoreManagerTx);

	// const registerReportManagerTx =
	// 	await nodeManagerContract.functions.registerReportManager(
	// 		reportManagerAddress
	// 	);
	// await registerReportManagerTx.wait();

	// console.log('registerReportManagerTx', registerReportManagerTx);

	// adjust initial values within AlphaNet TokenManager
	// ! FAILING DUE TO ESTIMATE GATE ISSUE
	// const blacklistTx = await tokenManagerContract.functions.addBlacklist(
	// 	nodeManagerAddress
	// );
	// await blacklistTx.wait();
	// const whitelistTx = await tokenManagerContract.functions.massAddWhitelist(
	// 	[storeManagerAddress, queryManagerAddress],
	// 	[nodeManagerAddress, nodeManagerAddress]
	// );
	// await whitelistTx.wait();
	// const whitelistTx1 = await tokenManagerContract.functions.addWhitelist(
	// 	storeManagerAddress,
	// 	nodeManagerAddress
	// );
	// await whitelistTx1.wait();
	// console.log(`tokenManagerAddress blacklist/whitelist updated`, {
	// 	whitelistTx: whitelistTx1.hash,
	// });
	// const whitelistTx2 = await tokenManagerContract.functions.addWhitelist(
	// 	queryManagerAddress,
	// 	nodeManagerAddress
	// );
	// await whitelistTx2.wait();
	// console.log(`tokenManagerAddress blacklist/whitelist updated`, {
	// 	whitelistTx: whitelistTx2.hash,
	// });

	console.log();
	// console.log(`tokenManagerAddress blacklist/whitelist updated`, {
	// 	// blacklistTx: blacklistTx.hash,
	// 	whitelistTx: whitelistTx.hash,
	// });

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
