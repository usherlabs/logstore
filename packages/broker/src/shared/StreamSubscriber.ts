import {
	LogStoreClient,
	MessageListener,
	Stream,
	Subscription,
} from '@logsn/client';

export class StreamSubscriber {
	private readonly subscriptions: Subscription[] = [];

	constructor(
		private readonly client: LogStoreClient,
		private readonly stream: Stream
	) {
		//
	}

	public async subscribe(onMessage: MessageListener) {
		const { partitions } = this.stream.getMetadata();

		for (let partition = 0; partition < partitions; partition++) {
			const subscription = await this.client.subscribe(
				{ id: this.stream.id, partition },
				onMessage
			);

			this.subscriptions.push(subscription);
		}
	}

	public async unsubscribe() {
		await Promise.all(
			this.subscriptions.map((subscription) => subscription.unsubscribe())
		);
		this.subscriptions.splice(0);
	}
}
