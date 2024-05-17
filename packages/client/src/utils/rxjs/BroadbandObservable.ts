// import type { StreamrClient } from '@streamr/sdk';
// import { MessageMetadata, Stream } from '@streamr/sdk';
// import { Observable } from 'rxjs';

// import { BroadbandSubscriber } from '../BroadbandSubscriber';

// /**
//  * Create an observable that listens to all partitions of a Streamr stream.
//  *
//  * @see BroadbandSubscriber
//  */
// export const createBroadbandObservable = (
// 	client: StreamrClient,
// 	stream: Stream
// ) => {
// 	return new Observable<[unknown, MessageMetadata]>((observer) => {
// 		const subscriber = new BroadbandSubscriber(client, stream);

// 		// Notifies the observer about new messages, as they arrive to the subscriber
// 		subscriber
// 			.subscribe((content, metadata) => {
// 				observer.next([content, metadata]);
// 			})
// 			.catch((e) => {
// 				// If the subscription fails with the error containing "Client is destroyed" we called destroy already, then complete.
// 				// Otherwise, we throw the error.
// 				// Handling it another way is harder as we should make all new promises canceable, and it wouldn't guarantee.
// 				if (e.message.includes('Client is destroyed')) {
// 					observer.complete();
// 				} else {
// 					observer.error(e);
// 				}
// 			});

// 		// Triggers BroadbandSubscriber#unsubscribe when the observable is unsubscribed
// 		return () => {
// 			subscriber.unsubscribe();
// 		};
// 	});
// };
