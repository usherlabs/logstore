import { LSAN__factory } from '@logsn/contracts';
import ContractAddresses from '@logsn/contracts/address.json';
import { ethers, Signer } from 'ethers';
import redstone from 'redstone-api';

export const getTokenPrice = async (
	tokenAddress: string,
	signer: Signer,
	timestamp: number
) => {
	// get the provider from the signer
	const provider = await signer.provider;
	if (!provider) throw new Error('no provider provided');

	// fetch the chain id to be used to fetch the right token addres
	const { chainId } = await provider?.getNetwork();
	const chainIdIndex = `${chainId}` as keyof typeof ContractAddresses;
	const { tokenManagerAddress: lsanTokenAddress } = ContractAddresses[
		chainIdIndex
	] as any;

	// initiaite a token contract
	const tokenContract = LSAN__factory.connect(tokenAddress, signer);

	// if we are dealing with the alpha token,
	// we can t get price information directly so we calculate ours
	if (tokenAddress === lsanTokenAddress) {
		const weiPerByte = await tokenContract.functions.price();
		const lsanPricePerMatic = ethers.utils.formatEther(+weiPerByte);
		const { value: maticPrice } = await redstone.getHistoricalPrice('MATIC', {
			date: timestamp,
			verifySignature: true,
		});
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
