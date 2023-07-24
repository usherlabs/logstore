import { LogStoreClient, Stream } from '@logsn/client';

export class StreamPublisher {
	private partitions: number;
	private counter: number = 0;

	constructor(
		private readonly client: LogStoreClient,
		private readonly stream: Stream
	) {
		this.partitions = this.stream.getMetadata().partitions;
	}

	public async publish(message: unknown) {
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
	}
}
