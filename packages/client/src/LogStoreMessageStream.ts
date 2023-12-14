/**
 * Wrapper around PushPipeline specific to StreamMessages.
 * Subscriptions are MessageStreams.
 * Not all MessageStreams are Subscriptions.
 */
import { MessageStream } from '@logsn/streamr-client';
import {
	EncryptedGroupKey,
	MessageID,
	MessageRef,
	StreamMessage,
} from '@streamr/protocol';
import { defer, type Observable, shareReplay, switchMap } from 'rxjs';
import { Message, MessageListener } from 'streamr-client';

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
		return defer(async () => {
			// for some reason, when used as observable does not trigger pipeline onStart signal, needed here
			// @ts-expect-error pipeline is internal
			await this.messageStream.pipeline.onStart.trigger();
		}).pipe(switchMap(() => this));
	}

	// pull method from messageStream runs the async iterator eagerly
	// however, to be able to postpone the stream usage (e.g. after system subscription) we make it lazy
	// by attaching the source when the pipeline is executed
	public setSourceOnStart(src$: Observable<StreamMessage<unknown>>) {
		// @ts-expect-error pipeline is internal
		const oldOnStart = this.messageStream.pipeline.onStart;
		// @ts-expect-error pipeline is internal
		this.messageStream.pipeline.onStart = {
			trigger: async () => {
				await this.messageStream.pull(src$[Symbol.asyncIterator]());
				await oldOnStart.trigger();
			},
		};
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
