import {
	LogStoreClient,
	MessageListener,
	Stream,
	Subscription,
} from '@logsn/client';

import { applyMiddlewares, Middleware } from '../helpers/middlewares';
import { getTelemetryContextMiddleware } from '../telemetry/utils/middlewares';

export type SubscriptionMiddleware = Middleware<MessageListener>;

const defaultMiddlewares: SubscriptionMiddleware[] = [
	getTelemetryContextMiddleware,
];

export class BroadbandSubscriber {
	private readonly partitions: number;
	private readonly subscriptions: Subscription[] = [];

	constructor(
		private readonly client: LogStoreClient,
		private readonly stream: Stream,
		private readonly middlewares: SubscriptionMiddleware[] = []
	) {
		this.partitions = this.stream.getMetadata().partitions;
	}

	public async subscribe(onMessage: MessageListener) {
		const promises = [];
		for (let partition = 0; partition < this.partitions; partition++) {
			const listener = applyMiddlewares(onMessage, [
				...defaultMiddlewares,
				...this.middlewares,
			]);
			promises.push(
				this.client.subscribe({ id: this.stream.id, partition }, listener)
			);
		}

		this.subscriptions.push(...(await Promise.all(promises)));
	}

	public async unsubscribe() {
		await Promise.all(
			this.subscriptions.map((subscription) => subscription.unsubscribe())
		);
		this.subscriptions.splice(0);
	}
}
