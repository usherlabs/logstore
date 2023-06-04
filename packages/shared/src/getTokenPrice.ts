import { LSAN__factory } from '@concertotech/logstore-contracts';
import ContractAddresses from '@concertotech/logstore-contracts/address.json';
import { Provider } from '@ethersproject/providers';
import { Contract, ethers, Signer } from 'ethers';
import redstone from 'redstone-api';

export const getTokenPrice = async (tokenAddress: string, signer: Signer) => {
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

	// if we are dealing with the dev token,
	// we can t get price information directly so we calculate ours
	if (tokenAddress === lsanTokenAddress) {
		const lsanPricePerMatic = await tokenContract.functions.getTokenPrice();
		const { value: maticPrice } = await redstone.getPrice('MATIC', {
			verifySignature: true,
		});
		// incase we get a zero back from the contract, default it to 1
		const lsanPricePerMaticFloored =
			+lsanPricePerMatic === 0 ? 1 : lsanPricePerMatic;
		const response = +lsanPricePerMaticFloored * maticPrice;
		return response;
	} else {
		// otherwise get the pricing information from redstone
		const tokenSymbol = await tokenContract.symbol();
		const resp = await redstone.getPrice(tokenSymbol, {
			verifySignature: true,
		});

		return resp.value;
	}
};
