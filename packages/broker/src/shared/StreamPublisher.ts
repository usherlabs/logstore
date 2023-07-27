import { LogStoreClient, Stream } from '@logsn/client';
import { Logger } from '@streamr/utils';

const logger = new Logger(module);

// Limit publishing messages per second per partiontion.
const LIMIT = 20;
// Delay in ms when reaching the limit
const DELAY = 100;

export class StreamPublisher {
	private partitions: number;
	private limit: number;
	private counter: number = 0;
	private timestamps: number[] = [];

	constructor(
		private readonly client: LogStoreClient,
		private readonly stream: Stream
	) {
		this.partitions = this.stream.getMetadata().partitions;
		this.limit = this.partitions * LIMIT;
	}

	public async publish(message: unknown) {
		await this.canPublish();
		const partition = this.counter % this.partitions;

		await this.client.publish(
			{
				id: this.stream.id,
				partition,
			},
			message
		);
		// await this.client.publish(this.stream, message, {
		// 	partitionKey: this.client.id,
		// });

		this.counter++;
		this.timestamps.push(Date.now());
	}

	private async canPublish() {
		const oneSecondAgo = Date.now() - 1000;

		this.timestamps = this.timestamps.filter(
			(timestamp) => timestamp >= oneSecondAgo
		);

		if (this.timestamps.length > this.limit) {
			logger.warn(
				'Publishing too many messages per second. Sleeping for %ims',
				DELAY
			);
			// wait for the DELAY to not flood the SystemStream
			await new Promise<void>((resolve) => setTimeout(() => resolve(), DELAY));
		}
	}
}
