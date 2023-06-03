import { LogStoreManager } from '@logsn/contracts';

export class StoreManager {
	constructor(private _contract: LogStoreManager) {}

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
			const storeId = e.args.store.toString();
			const amount = e.args.amount.toNumber();
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
			const storeId = e.args.store.toString();
			const amount = e.args.fees.toNumber();
			const sIndex = stores.findIndex((s) => s.id === storeId);
			if (sIndex >= 0) {
				stores[sIndex].amount -= amount;
			}
		});

		return stores;
	}
}
