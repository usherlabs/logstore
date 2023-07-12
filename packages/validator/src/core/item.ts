import { callWithBackoffStrategy } from '@kyvejs/protocol';
import { MessageMetadata } from '@logsn/client';
import { BigNumber } from 'ethers';
import { omit } from 'lodash';

import { Managers } from '../managers';

interface IPrepared {
	stores: {
		id: string;
		amount: BigNumber;
	}[];
}

export class Item {
	constructor(
		protected core: Validator,
		protected runtime: IRuntimeExtended,
		protected fromKey: string,
		protected toKey: string
	) {}

	override async load(managers: Managers) {
		const { toKey } = this;

		const toKeyInt = parseInt(toKey, 10);
		if (toKeyInt === 0) {
			return { stores: [] };
		}

		const toBlock = await this.runtime.time.find(toKeyInt);

		// Fetch full store list
		const stores = await managers.store.getStores(toBlock);

		return {
			stores,
		};
	}

	// eslint-disable-next-line
	public async generate(): Promise<any[]> {
		const { toKey, fromKey } = this;
		const { stores } = this.prepared;

		const toKeyInt = parseInt(toKey, 10);
		const fromKeyInt = parseInt(fromKey, 10);
		// Range will be from last key (timestamp) to this key
		const fromTimestamp = fromKeyInt * 1000;
		const toTimestamp = toKeyInt * 1000;

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
