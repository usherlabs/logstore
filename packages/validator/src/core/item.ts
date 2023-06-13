import { CONFIG_TEST, LogStoreClient } from '@logsn/client';
import { BigNumber } from 'ethers';
import { omit } from 'lodash';

import { getEvmPrivateKey, useStreamrTestConfig } from '../env-config';
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
		const { core, key } = this;

		const toKey = parseInt(key, 10);
		const block = await managers.getBlockByTime(toKey);
		core.logger.debug('produceItem:', {
			isMaxBlock: toKey >= block.timestamp,
			blockTs: block.timestamp,
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
		const { key } = this;
		const { stores } = this.prepared;

		// Range will be from last key (timestamp) to this key
		const toTimestamp = parseInt(key, 10) * 1000;
		const fromTimestamp = toTimestamp - 1000;
		const streamrConfig = useStreamrTestConfig() ? CONFIG_TEST : {};

		const logstore = new LogStoreClient({
			...streamrConfig,
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
