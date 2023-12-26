import type { StreamMetadata } from '@logsn/streamr-client';
import { distinctUntilChanged, filter, interval, map, switchMap } from 'rxjs';
import { inject, Lifecycle, scoped } from 'tsyringe';

import { type GQtyClient } from './utils/gqty';
import { GQtyClients } from './utils/GraphQLClient';

@scoped(Lifecycle.ContainerScoped)
export class StreamObservableFactory {
	private streamrGraphClient: GQtyClient;

	constructor(
		@inject(GQtyClients)
		graphQLClients: GQtyClients
	) {
		this.streamrGraphClient = graphQLClients.streamrClient;
	}

	public createStreamObservable = (
		streamId: string,
		updateInterval: number
	) => {
		return {
			metadataObservable: interval(updateInterval).pipe(
				switchMap(() =>
					this.streamrGraphClient.resolve(
						// using the graph
						(schema) => schema.query.stream({ id: streamId })?.metadata
					)
				),
				filter(Boolean),
				distinctUntilChanged(),
				map((s) => JSON.parse(s) as StreamMetadata)
			),

			// ? OR without using the graph
			// metadataObservable: interval(updateInterval).pipe(
			// 	switchMap(() => stream$),
			// 	map((s) => s.getMetadata()),
			// 	distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
			// ),
			// TODO: ? OR subscribe when available
			// metadataObservable: from(
			// 	this.streamrGraphClient.subscribe(
			// 		(schema) => schema.subscription.stream({ id: streamId })?.metadata,
			// 	map((s) => s.getMetadata()),
			// 	distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
			// 	)
			// ),
		};
	};
}
