/**
 * Wrapper around PushPipeline specific to StreamMessages.
 * Subscriptions are MessageStreams.
 * Not all MessageStreams are Subscriptions.
 */
import {
	EncryptedGroupKey,
	MessageID,
	MessageRef,
	SignatureType,
	StreamMessage,
} from '@streamr/protocol';
import { MessageListener } from '@streamr/sdk';
import { omit } from 'lodash';
import { Observable, defer, shareReplay, switchMap } from 'rxjs';

import { convertStreamMessageToMessage } from './streamr/Message';
import { IPushPipeline } from './streamr/utils/IPushPipeline';
import { PushBuffer } from './streamr/utils/PushBuffer';

export type LogStoreMessageMetadata = {
	id: MessageID;
	prevMsgRef?: MessageRef;
	messageType: number;
	contentType: number;
	encryptionType: number;
	groupKeyId?: string;
	newGroupKey?: EncryptedGroupKey;
	signature: Uint8Array;
	signatureType: SignatureType;
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
			| PushBuffer<Uint8Array | StreamMessage>
			| IPushPipeline<StreamMessage, StreamMessage>,
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
			const msg = convertStreamMessageToMessage(streamMessage);
			await onMessage(msg.content, omit(msg, 'content'));
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

export const convertStreamMessageToLogStoreMessage = (
	msg: StreamMessage
): LogStoreMessage => {
	return {
		content: msg.getParsedContent(),
		metadata: {
			id: msg.messageId,
			prevMsgRef: msg.prevMsgRef,
			messageType: msg.messageType,
			contentType: msg.contentType,
			signature: msg.signature,
			signatureType: msg.signatureType,
			encryptionType: msg.encryptionType,
			groupKeyId: msg.groupKeyId,
			newGroupKey: msg.newGroupKey,
		},
	};
};
