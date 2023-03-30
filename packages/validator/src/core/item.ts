import { LogStoreClient } from '@concertodao/logstore-client';
import { omit } from 'lodash';

import { Managers } from '../classes/Managers';
import { evmPrivateKey } from '../env-config';
import { getConfig } from '../utils/config';
import Validator from '../validator';

export const produceItem = async (
	core: Validator,
	managers: Managers,
	key: string
) => {
	const config = getConfig(core);
	const logstore = new LogStoreClient({
		auth: {
			privateKey: evmPrivateKey,
		},
	});

	// Range will be from last key (timestamp) to this key
	const toKey = parseInt(key, 10);
	const fromKey = toKey - config.itemTimeRange; // First iteration over the cache, will use the first nextKey -- ie. 1000

	const blockNumber = await managers.getBlockByTime(toKey);

	// Fetch full store list
	const stores = await managers.store.getStores(blockNumber);

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
};
