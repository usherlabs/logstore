import { BigNumber } from '@ethersproject/bignumber';
import { LogStoreManager } from '@logsn/contracts';

export class StoreManager {
	private fromBlockNumber: number = 0;
	private readonly stores: { id: string; amount: BigNumber }[] = [];

	constructor(private _contract: LogStoreManager) {}

	public get contract() {
		return this._contract;
	}

	public async getStores(
		fromBlockNumber: number,
		toBlockNumber: number
	): Promise<{ id: string; amount: BigNumber }[]> {
		if (this.fromBlockNumber < fromBlockNumber) {
			this.fromBlockNumber = fromBlockNumber;
		}

		// If the range already cached return the cached data
		if (this.fromBlockNumber > toBlockNumber) {
			return this.stores;
		}

		const storeUpdateEvents = await this.contract.queryFilter(
			this.contract.filters.StoreUpdated(),
			this.fromBlockNumber,
			toBlockNumber
		);

		const { stores } = this;

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
			this.fromBlockNumber,
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

		// Next time call for a range starting
		// from the block following the current toBlockNumber
		this.fromBlockNumber = toBlockNumber + 1;

		return stores;
	}
}
