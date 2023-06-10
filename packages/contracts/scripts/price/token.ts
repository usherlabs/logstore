// ! import { getTokenPrice } from '@logsn/shared'; Causes a cyclic dependency.... We have to re-implement this here.
import { ethers, Signer } from 'ethers';
import hre from 'hardhat';
import redstone from 'redstone-api';

import { LSAN__factory } from '../..';
import ContractAddresses from '../../address.json';

const getTokenPrice = async (tokenAddress: string, signer: Signer) => {
	const tokenContract = LSAN__factory.connect(tokenAddress, signer);
	const weiPerByte = await tokenContract.functions.price();
	const lsanPricePerMatic = ethers.utils.formatEther(+weiPerByte);
	const { value: maticPrice } = await redstone.getPrice('MATIC', {
		verifySignature: true,
	});
	const response = +lsanPricePerMatic * maticPrice;
	return response;
};

async function main() {
	console.log('Prints price of token used by Log Store\n');

	const chainIdIndex =
		`${hre.network.config.chainId}` as keyof typeof ContractAddresses;

	console.log('Chain ID:', chainIdIndex);

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
