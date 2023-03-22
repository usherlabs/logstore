import { BigNumber } from 'ethers';
import hre from 'hardhat';

import { STAKE_TOKEN_CONTRACTS, STREAMR_REGISTRY_ADDRESS } from './addresses';

export const getChainId = async () =>
	await hre.ethers.provider
		.getNetwork()
		.then((n: { chainId: number }) => n.chainId);

export const getAccounts = async () => hre.ethers.getSigners();

export const toBigDecimal = (amount: number, exponent = 18) => {
	if (amount < 0) throw 'amount < 0';
	return BigNumber.from(`${amount}${'0'.repeat(exponent)}`);
};

export async function getNodeManagerInputParameters() {
	// define important params
	const chainId = await getChainId();
	const [adminAccount] = await getAccounts();
	// define the common parameters
	const initialParameters = {
		address: adminAccount.address,
		requiresWhitelist: true,
		stakeToken: STAKE_TOKEN_CONTRACTS[chainId],
		stakeRequiredAmount: toBigDecimal(1, 17),
		initialNodes: [],
		initialMetadata: [],
	};
	// validations of variable parameters
	if (!initialParameters.stakeToken) throw `No token address for ${chainId}`;
	// depending on the chain we will use a different value for the staketoken parameter
	return Object.values(initialParameters);
}

export async function getStoreManagerInputParameters(
	nodeManagerAddress: string
) {
	// define important params
	const chainId = await getChainId();
	// define actual parameters
	const initialParameters = {
		owner: nodeManagerAddress,
		stakeToken: STAKE_TOKEN_CONTRACTS[chainId],
		streamrRegistryAddress: STREAMR_REGISTRY_ADDRESS[chainId],
	};
	// validations of variable parameters
	if (!initialParameters.stakeToken) throw `No token address for ${chainId}`;
	if (!initialParameters.streamrRegistryAddress)
		throw `No streamr address for ${chainId}`;
	// validations of variable parameters

	return Object.values(initialParameters);
}
