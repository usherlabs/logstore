import {
	SystemMessage,
	SystemMessageMap,
	SystemMessageType,
} from '@logsn/protocol';
import { MessageListener, MessageMetadata } from '@logsn/streamr-client';
import { Observable } from 'rxjs';

import { BroadbandSubscriber } from './BroadbandSubscriber';

export type SystemMessageValue<T = SystemMessage> = {
	message: T;
	metadata: MessageMetadata;
};

export type SystemMessageObservable = Observable<SystemMessageValue>;

// creating this to leverage rxjs tools to manage cold and hot subscriptions, shareReplay, etc.
export const systemMessageFromSubscriber = (
	subscriber: BroadbandSubscriber
) => {
	return new Observable<SystemMessageValue>((observer) => {
		const messageListener: MessageListener = (content, metadata) => {
			const message = SystemMessage.deserialize(content);
			observer.next({ message: message, metadata });
		};

		subscriber.subscribe(messageListener);

		return () => {
			subscriber.unsubscribe();
		};
	});
};

export const isSystemMessageOfType =
	<T extends SystemMessageType>(type: T) =>
	(
		systemMessage: SystemMessageValue
	): systemMessage is SystemMessageValue<SystemMessageMap[T]> => {
		return systemMessage.message.messageType === type;
	};
