import { ethers, upgrades } from 'hardhat';

async function main() {
	const LogStoreManager = await ethers.getContractFactory('LogStoreManager');
	const logStoreManager = await upgrades.deployProxy(LogStoreManager, [
		'0xa3d1F77ACfF0060F7213D7BF3c7fEC78df847De1',
		'0xbAA81A0179015bE47Ad439566374F2Bae098686F',
		'0x6cCdd5d866ea766f6DF5965aA98DeCCD629ff222',
	]);
	await logStoreManager.deployed();
	console.log(`LogStoreManager deployed to ${logStoreManager.address}`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
