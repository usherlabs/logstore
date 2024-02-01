import { Observable } from 'rxjs';
import type { StreamrClient } from 'streamr-client';
import { MessageListener, Stream } from 'streamr-client';
import { MessageMetadata } from 'streamr-client/types/src/Message';

import { BroadbandSubscriber } from '../BroadbandSubscriber';

export const createBroadbandObservable = (
	client: StreamrClient,
	stream: Stream
) => {
	return new Observable<[unknown, MessageMetadata]>((observer) => {
		const messageListener: MessageListener = (content, metadata) => {
			observer.next([content, metadata]);
		};

		const subscriber = new BroadbandSubscriber(client, stream);
		subscriber.subscribe(messageListener);

		return () => {
			subscriber.unsubscribe();
		};
	});
};
