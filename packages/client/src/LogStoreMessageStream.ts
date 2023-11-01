/**
 * Wrapper around PushPipeline specific to StreamMessages.
 * Subscriptions are MessageStreams.
 * Not all MessageStreams are Subscriptions.
 */
import {
	type Message,
	MessageListener,
	MessageStream,
} from '@logsn/streamr-client';
import {
	EncryptedGroupKey,
	MessageID,
	MessageRef,
	StreamMessage,
} from '@streamr/protocol';
import { defer, type Observable, shareReplay } from 'rxjs';

import type { RequestMetadata } from './HttpUtil';

export type LogStoreMessageMetadata = {
	id: MessageID;
	prevMsgRef: MessageRef | null;
	messageType: number;
	contentType: number;
	encryptionType: number;
	groupKeyId: string | null;
	newGroupKey: EncryptedGroupKey | null;
	signature: string;
};

export type LogStoreMessage = {
	content: unknown;
	metadata: LogStoreMessageMetadata;
};

/**
 * Provides asynchronous iteration with
 * {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of | for await .. of}.
 */
export class LogStoreMessageStream implements AsyncIterable<LogStoreMessage> {
	private messages$: Observable<Message>;

	constructor(
		public messageStream: MessageStream,
		public metadataStream: Observable<RequestMetadata>
	) {
		this.messages$ = defer(() => messageStream).pipe(
			// TODO this is a hack to be able to use the same MessageStream the user is using,
			// 	otherwise is hard to check the network state at the same time
			// so we don't get error if we try to iterate more than once
			shareReplay({ refCount: true })
		);
	}

	/**
	 * Attach a legacy onMessage handler and consume if necessary.
	 * onMessage is passed parsed content as first arument, and streamMessage as second argument.
	 */
	useLegacyOnMessageHandler(onMessage: MessageListener): this {
		this.messageStream.useLegacyOnMessageHandler(onMessage);
		return this;
	}

	public asObservable() {
		return defer(() => this);
	}

	async *[Symbol.asyncIterator](): AsyncIterator<LogStoreMessage> {
		for await (const msg of this.messages$) {
			// @ts-expect-error this is marked as internal in MessageStream
			const streamMessage: StreamMessage = msg.streamMessage;
			yield convertStreamMessageToMessage(streamMessage);
		}
	}
}

export const convertStreamMessageToMessage = (
	msg: StreamMessage
): LogStoreMessage => {
	return {
		content: msg.getParsedContent(),
		metadata: {
			id: msg.getMessageID(),
			prevMsgRef: msg.getPreviousMessageRef(),
			newGroupKey: msg.getNewGroupKey(),
			signature: msg.signature,
			// I'm also including these for further usage:
			messageType: msg.messageType,
			contentType: msg.contentType,
			encryptionType: msg.encryptionType,
			groupKeyId: msg.groupKeyId,
		},
	};
};
