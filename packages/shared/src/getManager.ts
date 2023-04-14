import {
	LogStoreManager,
	LogStoreManager__factory,
	LogStoreNodeManager,
	LogStoreNodeManager__factory,
	LogStoreQueryManager,
	LogStoreQueryManager__factory,
} from '@concertodao/logstore-contracts';
import ContractAddresses from '@concertodao/logstore-contracts/address.json';
import { providers, Signer } from 'ethers';

import { Manager, Network } from './types';

export async function getNodeManagerContract(
	signerOrProvider: Signer | providers.Provider
) {
	return (await getManagerContract(
		signerOrProvider,
		Manager.NodeManager
	)) as LogStoreNodeManager;
}

export async function getQueryManagerContract(
	signerOrProvider: Signer | providers.Provider
) {
	return (await getManagerContract(
		signerOrProvider,
		Manager.QueryManager
	)) as LogStoreQueryManager;
}

export async function getStoreManagerContract(
	signerOrProvider: Signer | providers.Provider
) {
	return (await getManagerContract(
		signerOrProvider,
		Manager.StoreManager
	)) as LogStoreManager;
}

export async function getManagerContract(
	signerOrProvider: Signer | providers.Provider,
	manager: Manager
) {
	const network =
		signerOrProvider instanceof Signer
			? await signerOrProvider.provider?.getNetwork()
			: await signerOrProvider.getNetwork();

	if (!network) {
		throw new Error('Network not defined');
	}

	const managerAddress = getManagerAddress(network.chainId, manager);

	switch (manager) {
		case Manager.NodeManager:
			return LogStoreNodeManager__factory.connect(
				managerAddress,
				signerOrProvider
			);
		case Manager.QueryManager:
			return LogStoreQueryManager__factory.connect(
				managerAddress,
				signerOrProvider
			);
		case Manager.StoreManager:
			return LogStoreManager__factory.connect(managerAddress, signerOrProvider);
		default:
			throw new Error('Unexpected manager');
	}
}

function getManagerAddress(chainId: number, manager: Manager) {
	const network = chainId as Network;
	switch (manager) {
		case Manager.NodeManager:
			return ContractAddresses[network].nodeManagerAddress;
		case Manager.QueryManager:
			return ContractAddresses[network].queryManagerAddress;
		case Manager.StoreManager:
			return ContractAddresses[network].storeManagerAddress;
		default:
			throw new Error('Unexpected manager');
	}
}
