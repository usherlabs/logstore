/**
 * Wrapper around PushPipeline specific to StreamMessages.
 * Subscriptions are MessageStreams.
 * Not all MessageStreams are Subscriptions.
 */
import {
	EncryptedGroupKey,
	MessageID,
	MessageRef,
	StreamMessage,
} from '@streamr/protocol';
import { Message, MessageListener } from '@streamr/sdk';
import { omit } from 'lodash';
import { Observable, defer, shareReplay, switchMap } from 'rxjs';

import type { RequestMetadata } from './HttpUtil';
import { IPushPipeline } from './streamr/utils/IPushPipeline';
import { PushBuffer } from './streamr/utils/PushBuffer';

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
	private messages$: Observable<StreamMessage>;

	constructor(
		public messageStream:
			| PushBuffer<string | StreamMessage>
			| IPushPipeline<StreamMessage, StreamMessage>,
		public metadataStream: Observable<RequestMetadata>
	) {
		this.messages$ = defer(() => {
			// @ts-expect-error Property 'iterate' does not exist on type 'IPushPipeline<StreamMessage<unknown>, StreamMessage<unknown>>'
			return messageStream.iterate() as AsyncGenerator<StreamMessage>;
		}).pipe(shareReplay({ refCount: true }));
	}

	/**
	 * Attach a legacy onMessage handler and consume if necessary.
	 * onMessage is passed parsed content as first arument, and streamMessage as second argument.
	 */
	useLegacyOnMessageHandler(onMessage: MessageListener): this {
		if (this.messageStream instanceof PushBuffer) {
			return this;
		}

		this.messageStream.onMessage.listen(async (streamMessage) => {
			if (typeof streamMessage !== 'string') {
				const msg = convertStreamMessageToMessage(streamMessage);
				await onMessage(msg.content, omit(msg, 'content'));
			}
		});
		this.messageStream.flow();

		return this;
	}

	public asObservable() {
		return defer(async () => this).pipe(switchMap(() => this));
	}

	async *[Symbol.asyncIterator](): AsyncIterator<LogStoreMessage> {
		for await (const msg of this.messages$) {
			if (typeof msg === 'string') {
				yield msg;
			} else {
				yield convertStreamMessageToLogStoreMessage(msg);
			}
		}
	}
}

export const convertStreamMessageToMessage = (msg: StreamMessage): Message => {
	return {
		content: msg.getParsedContent(),
		streamId: msg.getStreamId(),
		streamPartition: msg.getStreamPartition(),
		timestamp: msg.getTimestamp(),
		sequenceNumber: msg.getSequenceNumber(),
		signature: msg.signature,
		publisherId: msg.getPublisherId(),
		msgChainId: msg.getMsgChainId(),
		// @ts-expect-error streamMessage is marked as internal in Message interface
		streamMessage: msg,
	};
};

export const convertStreamMessageToLogStoreMessage = (
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
