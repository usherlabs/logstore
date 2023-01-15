import ethers from 'ethers';
import EthersAdapter from '@gnosis.pm/safe-ethers-lib';
import Safe from '@gnosis.pm/safe-core-sdk';

export async function getSafe(signer: ethers.Wallet, safeAddress: string) {
	// Setup the EthersAdapter
	const adapter = new EthersAdapter({
		ethers,
		signer,
	});
	const safeSdk: Safe = await Safe.create({
		ethAdapter: adapter,
		safeAddress,
	});

	return safeSdk;
}
