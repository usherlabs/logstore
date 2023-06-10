import { getTokenPrice } from '@logsn/shared';
import hre from 'hardhat';

import ContractAddresses from '../../address.json';

async function main() {
	console.log('Prints price of token used by Log Store\n');

	const chainIdIndex =
		`${hre.network.config.chainId}` as keyof typeof ContractAddresses;

	const { tokenManagerAddress: lsanTokenAddress } = ContractAddresses[
		chainIdIndex
	] as any;

	const signers = await hre.ethers.getSigners();
	const [signer] = signers;
	const price = await getTokenPrice(lsanTokenAddress, signer);

	console.log(`Token Price (per Byte): $${price.toFixed(18)} USD`);
	console.log(`Token Price (per kB): $${(price * 1000).toFixed(18)} USD`);
	console.log(
		`Token Price (per mB): $${(price * 1000 * 1000).toFixed(18)} USD`
	);
	console.log(
		`Token Price (per gB): $${(price * 1000 * 1000 * 1000).toFixed(18)} USD`
	);
	console.log(
		`Token Price (per tB): $${(price * 1000 * 1000 * 1000 * 1000).toFixed(
			18
		)} USD`
	);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
