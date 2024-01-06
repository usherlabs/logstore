import { EthereumAddress, MessageMetadata } from 'streamr-client';

import { BroadbandSubscriber } from '../shared/BroadbandSubscriber';

const THRESHOLD = 10 * 1000;

export class Heartbeat {
	private brokers: Map<EthereumAddress, number>;

	constructor(private readonly subscriber: BroadbandSubscriber) {
		this.brokers = new Map();
	}

	public async start() {
		await this.subscriber.subscribe(this.onMessage.bind(this));
	}

	public async stop() {
		await this.subscriber.unsubscribe();
	}

	public get onlineBrokers() {
		const result: EthereumAddress[] = [];
		for (const broker of this.brokers) {
			const timestamp = broker[1];
			if (Date.now() - timestamp <= THRESHOLD) {
				result.push();
			}
		}

		return result;
	}

	private async onMessage(_: unknown, metadata: MessageMetadata) {
		this.brokers.set(metadata.publisherId, metadata.timestamp);
	}
}
