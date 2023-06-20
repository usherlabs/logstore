import { BigNumber } from 'ethers';
import { omit } from 'lodash';

import { Managers } from '../managers';
import { AbstractDataItem } from './abstract';

interface IPrepared {
	stores: {
		id: string;
		amount: BigNumber;
	}[];
}

export class Item extends AbstractDataItem<IPrepared> {
	prepared: IPrepared;

	override async load(managers: Managers) {
		const { key } = this;

		const toKey = parseInt(key, 10);
		if (toKey === 0) {
			return { stores: [] };
		}

		const block = await this.runtime.time.find(toKey);

		// Fetch full store list
		const stores = await managers.store.getStores(block);

		return {
			stores,
		};
	}

	// eslint-disable-next-line
	public async generate(): Promise<any[]> {
		const { key } = this;
		const { stores } = this.prepared;

		// Range will be from last key (timestamp) to this key
		const toTimestamp = parseInt(key, 10) * 1000;
		const fromTimestamp = toTimestamp - 1000;

		const messages = [];
		for (let i = 0; i < stores.length; i++) {
			const store = stores[i];
			const resp = await this.runtime.listener.client.query(
				{
					id: store.id,
				},
				{
					from: {
						timestamp: fromTimestamp,
					},
					to: {
						timestamp: toTimestamp,
					},
				}
			);
			for await (const msg of resp) {
				messages.push({ content: msg.content, metadata: omit(msg, 'content') });
			}
		}

		return messages;
	}
}
