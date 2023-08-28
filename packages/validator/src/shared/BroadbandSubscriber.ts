import {
	LogStoreClient,
	MessageListener,
	Stream,
	Subscription,
} from '@logsn/client';

export class BroadbandSubscriber {
	private readonly partitions: number;
	private readonly subscriptions: Subscription[] = [];

	constructor(
		private readonly client: LogStoreClient,
		private readonly stream: Stream,
	) {
		this.partitions = this.stream.getMetadata().partitions;
	}

	public async subscribe(onMessage: MessageListener) {
		const promises = [];
		for (let partition = 0; partition < this.partitions; partition++) {
			promises.push(
				this.client.subscribe({ id: this.stream.id, partition }, onMessage),
			);
		}

		this.subscriptions.push(...(await Promise.all(promises)));
	}

	public async unsubscribe() {
		await Promise.all(
			this.subscriptions.map((subscription) => subscription.unsubscribe()),
		);
		this.subscriptions.splice(0);
	}
}
