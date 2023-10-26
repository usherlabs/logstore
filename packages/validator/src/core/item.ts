import { callWithBackoffStrategy } from '@kyvejs/protocol';
import type { Logger } from 'tslog';

import type { IRuntimeExtended } from '../types';

type BundleMessageMetadata = {
	messageId: {
		streamId: string;
		streamPartition: number;
		timestamp: number;
		sequenceNumber: number;
		publisherId: string;
		msgChainId: string;
	};
	prevMsgRef: {
		timestamp: number;
		sequenceNumber: number;
	} | null;
	messageType: number;
	contentType: number;
	encryptionType: number;
	groupKeyId: string | null;
	serializedNewGroupKey: string | null;
	signature: string;
};

type BundleMessage = {
	content: unknown;
	metadata: BundleMessageMetadata;
};

export class Item {
	constructor(
		protected runtime: IRuntimeExtended,
		protected logger: Logger,
		protected fromKey: string,
		protected toKey: string
	) {}

	public stringifiedMessageId = (
		id: BundleMessageMetadata['messageId']
	): string => {
		const { streamId, streamPartition, timestamp, sequenceNumber } = id;
		return `${streamId}/${streamPartition}/${timestamp}/${sequenceNumber}`;
	};

	// TODO start proof of queries fetch:
	// 	- start proof of queries fetch between same timestamps as DataItem (request to /prove/queries)
	//  - check if timestamp returned is greater than timestamp which this validator joined the network, if so
	//   then should not take action here

	// TODO wait for messages on alive brokers
	//  - listen to the network for system messages with the metadata flush
	//  - verify QueryMetadata
	//  - cache this QueryMetadata

	async requestProofOfQueries(): Promise<void> {
		// await this.
	}

	public async generate(): Promise<BundleMessage[]> {
		const { toKey, fromKey } = this;

		const toKeyInt = parseInt(toKey, 10);
		if (toKeyInt === 0) {
			return [];
		}

		const toBlock = this.runtime.time.find(toKeyInt);

		// Fetch full store list
		const stores = await this.runtime.managers.store.getStores(toBlock);

		const fromKeyInt = parseInt(fromKey, 10);
		// Range will be from last key (timestamp) to this key
		const fromTimestamp = fromKeyInt * 1000;
		const toTimestamp = toKeyInt * 1000;

		const messages: BundleMessage[] = [];
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
						const {
							metadata: { newGroupKey, id, ...metadata },
						} = msg;
						messages.push({
							content: msg.content,
							metadata: {
								...metadata,
								messageId: id,
								serializedNewGroupKey: newGroupKey.serialize(),
							},
						});
					}
				},
				{
					limitTimeoutMs: 5 * 60 * 1000,
					increaseByMs: 10 * 1000,
				},
				(err, ctx) => {
					this.logger.warn('Failed to get item', err, ctx);
				}
			);
		}

		const sortedMessages = messages.sort((a, b) => {
			return this.stringifiedMessageId(a.metadata.messageId).localeCompare(
				this.stringifiedMessageId(b.metadata.messageId)
			);
		});

		return sortedMessages;
	}
}
