import { LogStoreClient, Stream } from '@logsn/client';
import { trace } from '@opentelemetry/api';
import _ from 'lodash';

import { applyMiddlewares, Middleware } from '../helpers/middlewares';
import { addTelemetryContextToPublishedMessageMiddleware } from '../telemetry/utils/middlewares';

export type PublishMiddlewares = Middleware<(message: string) => string>;

const defaultMiddlewares: PublishMiddlewares[] = [
	addTelemetryContextToPublishedMessageMiddleware,
];

export class BroadbandPublisher {
	private readonly partitions: number;
	private counter: number = 0;

	constructor(
		private readonly client: LogStoreClient,
		private readonly stream: Stream,
		private readonly middlewares: PublishMiddlewares[] = []
	) {
		this.partitions = this.stream.getMetadata().partitions;
	}

	public getAddress() {
		return this.client.getAddress();
	}

	public async publish(message: unknown) {
		const partition = this.counter % this.partitions;
		const span = trace.getActiveSpan();
		span?.addEvent('publish');

		const getFinalMessage = applyMiddlewares(_.identity, [
			...defaultMiddlewares,
			...this.middlewares,
		]);

		await this.client.publish(
			{
				id: this.stream.id,
				partition,
			},
			getFinalMessage(message as string)
		);

		this.counter++;
	}
}
