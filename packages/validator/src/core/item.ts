import { callWithBackoffStrategy } from '@kyvejs/protocol';
import { MessageMetadata } from '@logsn/client';
import { BigNumber } from 'ethers';
import { omit } from 'lodash';

import { Managers } from '../managers';
import { rollingConfig } from '../shared/rollingConfig';
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
		const { toKey: key } = this;

		const toKey = parseInt(key, 10);
		if (toKey === 0) {
			return { stores: [] };
		}

		const fromBlock = await this.runtime.startBlockNumber();
		const toBlock = await this.runtime.time.find(toKey);

		// Fetch full store list
		const stores = await managers.store.getStores(fromBlock, toBlock);

		return {
			stores,
		};
	}

	// eslint-disable-next-line
	public async generate(): Promise<any[]> {
		const { toKey: key } = this;
		const { stores } = this.prepared;

		const keyInt = parseInt(key, 10);
		// Range will be from last key (timestamp) to this key
		const fromTimestamp = (keyInt - rollingConfig(keyInt).prev.keyStep) * 1000;
		const toTimestamp = keyInt * 1000;

		const messages: {
			content: unknown;
			metadata: MessageMetadata;
		}[] = [];
		for (let i = 0; i < stores.length; i++) {
			const store = stores[i];

			await callWithBackoffStrategy(
				async () => {
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
						messages.push({
							content: msg.content,
							metadata: omit(msg, 'content'),
						});
					}
				},
				{
					limitTimeoutMs: 5 * 60 * 1000,
					increaseByMs: 10 * 1000,
				},
				(err, ctx) => {
					this.core.logger.warn('Failed to get item', err, ctx);
				}
			);
		}

		const messageId = (metadata: MessageMetadata): string => {
			const { streamId, streamPartition, timestamp, sequenceNumber } = metadata;
			return `${streamId}/${streamPartition}/${timestamp}/${sequenceNumber}`;
		};

		const sortedMessages = messages.sort((a, b) => {
			return messageId(a.metadata).localeCompare(messageId(b.metadata));
		});

		return sortedMessages;
	}
}
