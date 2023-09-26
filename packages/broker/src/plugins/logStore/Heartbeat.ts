import { EthereumAddress, MessageMetadata } from '@logsn/client';

import { BroadbandPublisher } from '../../shared/BroadbandPublisher';
import { BroadbandSubscriber } from '../../shared/BroadbandSubscriber';

const INTERVAL = 1 * 1000;
const THRESHOLD = 10 * 1000;

export class Heartbeat {
	private brokers: Map<EthereumAddress, number>;
	private timer?: NodeJS.Timer;

	constructor(
		private readonly publisher: BroadbandPublisher,
		private readonly subscriber: BroadbandSubscriber
	) {
		this.brokers = new Map();
	}

	public async start() {
		await this.subscriber.subscribe(this.onMessage.bind(this));
		this.timer = setInterval(this.onInterval.bind(this), INTERVAL);
	}

	public async stop() {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = undefined;
		}
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

	private async onInterval() {
		await this.publisher.publish('');
	}

	private async onMessage(_: unknown, metadata: MessageMetadata) {
		this.brokers.set(metadata.publisherId, metadata.timestamp);
	}
}
