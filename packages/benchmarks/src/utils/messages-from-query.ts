import { LogStoreClient } from '@logsn/client';
import type { QueryInput } from '@logsn/client/src/Queries';
import { Observable } from 'rxjs';
import { Stream } from 'streamr-client';

export const messagesFromQuery = (
	client: LogStoreClient,
	lsStream: Stream,
	query: QueryInput
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
				stream.messageStream.endWrite();
			});
		};
	});
