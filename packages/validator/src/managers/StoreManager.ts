import { BigNumber } from '@ethersproject/bignumber';
import { LogStoreManager } from '@logsn/contracts';

export class StoreManager {
	constructor(private _contract: LogStoreManager) {}

	public get contract() {
		return this._contract;
	}

	public async getStores(
		fromBlockNumber: number,
		toBlockNumber: number
	): Promise<{ id: string; amount: BigNumber }[]> {
		const storeUpdateEvents = await this.contract.queryFilter(
			this.contract.filters.StoreUpdated(),
			fromBlockNumber,
			toBlockNumber
		);
		const stores: { id: string; amount: BigNumber }[] = [];
		storeUpdateEvents.forEach((e) => {
			const storeId = e.args.store.toString();
			const amount = e.args.amount;
			const sIndex = stores.findIndex((s) => s.id === storeId);
			if (sIndex < 0) {
				stores.push({
					id: storeId,
					amount,
				});
				return;
			}
			stores[sIndex].amount = stores[sIndex].amount.add(amount);
		});
		const dataStoredEvents = await this.contract.queryFilter(
			this.contract.filters.DataStored(),
			fromBlockNumber,
			toBlockNumber
		);
		dataStoredEvents.forEach((e) => {
			const storeId = e.args.store.toString();
			const amount = e.args.fees as BigNumber;
			const sIndex = stores.findIndex((s) => s.id === storeId);
			if (sIndex >= 0) {
				stores[sIndex].amount = stores[sIndex].amount.sub(amount);
			}
		});

		return stores;
	}
}
