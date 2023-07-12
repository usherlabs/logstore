import { BigNumber } from '@ethersproject/bignumber';

import type { ChainSources } from '../sources';
import type { EventsIndexer } from '../threads';
import { EventSelect } from '../threads';

export class StoreManager {
	constructor(
		protected chain: ChainSources,
		protected indexer: EventsIndexer
	) {}

	public async getStores(
		toBlockNumber: number
	): Promise<{ id: string; amount: BigNumber }[]> {
		const events = await this.indexer.query(
			[EventSelect.DataStored, EventSelect.StoreUpdated],
			toBlockNumber
		);

		const stores: { id: string; amount: BigNumber }[] = [];
		events.forEach((event) => {
			event.value.StoreUpdated.forEach((e) => {
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

			event.value.DataStored.forEach((e) => {
				const storeId = e.args.store.toString();
				const amount = e.args.fees as BigNumber;
				const sIndex = stores.findIndex((s) => s.id === storeId);
				if (sIndex >= 0) {
					stores[sIndex].amount = stores[sIndex].amount.sub(amount);
				}
			});
		});

		return stores;
	}
}
