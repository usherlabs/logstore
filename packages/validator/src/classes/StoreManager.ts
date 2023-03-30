import { abi as StoreManagerContractABI } from '@concertodao/logstore-contracts/artifacts/src/StoreManager.sol/LogStoreManager.json';
import { ethers, EventLog } from 'ethers';

export class StoreManagerContract {
	private _contract: ethers.Contract;

	constructor(provider: ethers.Provider, address: string) {
		this._contract = new ethers.Contract(address, StoreManagerContractABI, {
			provider,
		});
	}

	public get contract() {
		return this._contract;
	}

	public async getStores(
		toBlockNumber?: number
	): Promise<{ id: string; amount: number }[]> {
		const storeUpdateEvents = await this.contract.queryFilter(
			this.contract.filters.StoreUpdated(),
			0,
			toBlockNumber
		);
		const stores: { id: string; amount: number }[] = [];
		storeUpdateEvents.forEach((e) => {
			if (!(e instanceof EventLog)) {
				return;
			}
			const storeId = e.args.getValue('store');
			const amount = e.args.getValue('amount');
			const sIndex = stores.findIndex((s) => s.id === storeId);
			if (sIndex < 0) {
				stores.push({
					id: storeId,
					amount,
				});
				return;
			}
			stores[sIndex].amount += amount;
		});
		const dataStoredEvents = await this.contract.queryFilter(
			this.contract.filters.DataStored(),
			0,
			toBlockNumber
		);
		dataStoredEvents.forEach((e) => {
			if (!(e instanceof EventLog)) {
				return;
			}
			const storeId = e.args.getValue('store');
			const amount = e.args.getValue('fees');
			const sIndex = stores.findIndex((s) => s.id === storeId);
			if (sIndex >= 0) {
				stores[sIndex].amount -= amount;
			}
		});

		return stores;
	}
}
