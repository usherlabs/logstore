import {
	LogStoreManager,
	LogStoreManager__factory,
	LogStoreNodeManager,
	LogStoreNodeManager__factory,
	LogStoreQueryManager,
	LogStoreQueryManager__factory,
} from '@concertodao/logstore-contracts';
import ContractAddresses from '@concertodao/logstore-contracts/address.json';
import { ethers } from 'ethers';

import { Manager, Network } from './types';

export async function getNodeManagerContract(wallet: ethers.Wallet) {
	return (await getManagerContract(
		wallet,
		Manager.NodeManager
	)) as LogStoreNodeManager;
}

export async function getQueryManagerContract(wallet: ethers.Wallet) {
	return (await getManagerContract(
		wallet,
		Manager.QueryManager
	)) as LogStoreQueryManager;
}

export async function getStoreManagerContract(wallet: ethers.Wallet) {
	return (await getManagerContract(
		wallet,
		Manager.StoreManager
	)) as LogStoreManager;
}

export async function getManagerContract(
	wallet: ethers.Wallet,
	manager: Manager
) {
	const network = await wallet.provider.getNetwork();
	const managerAddress = getManagerAddress(network.chainId, manager);

	switch (manager) {
		case Manager.NodeManager:
			return LogStoreNodeManager__factory.connect(managerAddress, wallet);
		case Manager.QueryManager:
			return LogStoreQueryManager__factory.connect(managerAddress, wallet);
		case Manager.StoreManager:
			return LogStoreManager__factory.connect(managerAddress, wallet);
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
