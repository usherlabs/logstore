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

import { Manager } from './types';

export async function getNodeMangerCotnract(wallet: ethers.Wallet) {
	return (await getMangerContract(
		wallet,
		Manager.NodeManager
	)) as LogStoreNodeManager;
}

export async function getQeryMangerCotnract(wallet: ethers.Wallet) {
	return (await getMangerContract(
		wallet,
		Manager.QueryManager
	)) as LogStoreQueryManager;
}

export async function getStoreMangerCotnract(wallet: ethers.Wallet) {
	return (await getMangerContract(
		wallet,
		Manager.StoreManager
	)) as LogStoreManager;
}

export async function getMangerContract(
	wallet: ethers.Wallet,
	manager: Manager
) {
	const network = await wallet.provider.getNetwork();
	const managerAddress = getMangerAddress(network.chainId, manager);

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

function getMangerAddress(chainId: number, manager: Manager) {
	switch (manager) {
		case Manager.NodeManager:
			return ContractAddresses[chainId].nodeManagerAddress;
		case Manager.QueryManager:
			return ContractAddresses[chainId].queryManagerAddress;
		case Manager.StoreManager:
			return ContractAddresses[chainId].storeManagerAddress;
		default:
			throw new Error('Unexpected manager');
	}
}
