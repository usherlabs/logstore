import { LogStoreClient, Stream } from '@logsn/client';
import type { QueryOptions } from '@logsn/client/src/Queries';
import { Observable } from 'rxjs';

export const messagesFromQuery = (
	client: LogStoreClient,
	lsStream: Stream,
	query: QueryOptions
) =>
	new Observable<unknown>((subscriber) => {
		const streamPromise = client.query(
			{ streamId: lsStream.id, partition: 0 },
			query,
			(msg: unknown) => {
				subscriber.next(msg);
			}
		);

		return () => {
			void streamPromise.then((stream) => {
				stream.endWrite();
			});
		};
	});
