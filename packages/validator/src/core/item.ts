import { LogStoreClient } from '@concertodao/logstore-client';
import { omit } from 'lodash';

import { getEvmPrivateKey } from '../env-config';
import { Managers } from '../managers';
import { AbstractDataItem } from './abstract';

interface IPrepared {
	stores: {
		id: string;
		amount: number;
	}[];
}

export class Item extends AbstractDataItem<IPrepared> {
	prepared: IPrepared;

	override async load(managers: Managers) {
		const { core, key } = this;

		const toKey = parseInt(key, 10);
		const block = await managers.getBlockByTime(toKey);
		core.logger.debug('produceItem:', {
			isMaxBlock: toKey >= block.timestamp * 1000,
			blockTs: block.timestamp * 1000,
			ts: toKey,
		});

		// Fetch full store list
		const stores = await managers.store.getStores(block.number);

		return {
			stores,
		};
	}

	// eslint-disable-next-line
	public async generate(): Promise<any[]> {
		const { key, config } = this;
		const { stores } = this.prepared;

		// Range will be from last key (timestamp) to this key
		const toKey = parseInt(key, 10);
		const fromKey = toKey - config.itemTimeRange; // First iteration over the cache, will use the first nextKey -- ie. 1000

		const logstore = new LogStoreClient({
			auth: {
				privateKey: getEvmPrivateKey(), // The Validator needs to stake in QueryManager
			},
		});

		const messages = [];
		for (let i = 0; i < stores.length; i++) {
			const store = stores[i];
			const resp = await logstore.query(
				{
					id: store.id,
				},
				{
					from: {
						timestamp: fromKey,
					},
					to: {
						timestamp: toKey,
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
