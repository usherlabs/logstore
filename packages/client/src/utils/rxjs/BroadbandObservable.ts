import { Observable } from 'rxjs';
import type { StreamrClient } from 'streamr-client';
import { Stream } from 'streamr-client';
import { MessageMetadata } from 'streamr-client/types/src/Message';

import { BroadbandSubscriber } from '../BroadbandSubscriber';


/**
 * Create an observable that listens to all partitions of a Streamr stream.
 *
 * @see BroadbandSubscriber
 */
export const createBroadbandObservable = (
	client: StreamrClient,
	stream: Stream
) => {
	return new Observable<[unknown, MessageMetadata]>((observer) => {
		const subscriber = new BroadbandSubscriber(client, stream);

		// Notifies the observer about new messages, as they arrive to the subscriber
		subscriber.subscribe((content, metadata) => {
			observer.next([content, metadata]);
		});

		// Triggers BroadbandSubscriber#unsubscribe when the observable is unsubscribed
		return () => {
			subscriber.unsubscribe();
		};
	});
};
