/**
 * Wrapper around PushPipeline specific to StreamMessages.
 * Subscriptions are MessageStreams.
 * Not all MessageStreams are Subscriptions.
 */
import { MessageListener, MessageStream } from '@logsn/streamr-client';
import {
	EncryptedGroupKey,
	MessageID,
	MessageRef,
	StreamMessage,
} from '@streamr/protocol';

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
	constructor(public messageStream: MessageStream) {}

	/**
	 * Attach a legacy onMessage handler and consume if necessary.
	 * onMessage is passed parsed content as first arument, and streamMessage as second argument.
	 */
	useLegacyOnMessageHandler(onMessage: MessageListener): this {
		this.messageStream.useLegacyOnMessageHandler(onMessage);
		return this;
	}

	async *[Symbol.asyncIterator](): AsyncIterator<LogStoreMessage> {
		for await (const msg of this.messageStream) {
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
