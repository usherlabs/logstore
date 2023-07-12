import { LSAN__factory } from '@logsn/contracts';
import ContractAddresses from '@logsn/contracts/address.json';
import { ethers } from 'ethers';
import redstone from 'redstone-api';

export async function getMaticPrice(timestamp: number) {
	const { value: maticPrice } = await redstone.getHistoricalPrice('MATIC', {
		date: timestamp,
		verifySignature: true,
	});
	return maticPrice;
}

export const getTokenPrice = async (
	tokenAddress: string,
	timestamp: number,
	provider?: ethers.providers.Provider
) => {
	// get the provider from the signer
	if (!provider)
		throw new Error('Cannot get Token Price in USD. No provider provided');

	// fetch the chain id to be used to fetch the right token addres
	const { chainId } = await provider.getNetwork();
	const chainIdIndex = `${chainId}` as keyof typeof ContractAddresses;
	const { tokenManagerAddress: lsanTokenAddress } = ContractAddresses[
		chainIdIndex
	] as any;

	// initiaite a token contract
	const tokenContract = LSAN__factory.connect(tokenAddress, provider);

	// if we are dealing with the alpha token,
	// we can t get price information directly so we calculate ours
	if (tokenAddress === lsanTokenAddress) {
		const weiPerByte = await tokenContract.functions.price();
		const lsanPricePerMatic = ethers.utils.formatEther(+weiPerByte);
		const maticPrice = await getMaticPrice(timestamp);
		const response = +lsanPricePerMatic * maticPrice;
		return response;
	}

	// otherwise get the pricing information from redstone
	const tokenSymbol = await tokenContract.symbol();
	const resp = await redstone.getHistoricalPrice(tokenSymbol, {
		date: timestamp,
		verifySignature: true,
	});

	return resp.value;
};
