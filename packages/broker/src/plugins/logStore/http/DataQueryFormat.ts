import { EncryptionType, StreamMessage } from '@streamr/protocol';

export interface Format {
	getMessageAsString: (
		streamMessage: StreamMessage,
		version: number | undefined
	) => string;
	contentType: string;
	delimiter: string;
	header: string;
	footer: ((metadata: Record<string, any>) => string) | string;
}

const createJsonFormat = (
	getMessageAsString: (
		streamMessage: StreamMessage,
		version: number | undefined
	) => string
): Format => {
	return {
		getMessageAsString,
		contentType: 'application/json',
		delimiter: ',',
		header: '{"messages":[',
		footer: (metadata) => `],"metadata":${JSON.stringify(metadata)}}`,
	};
};

const createPlainTextFormat = (
	getMessageAsString: (
		streamMessage: StreamMessage,
		version: number | undefined
	) => string
): Format => {
	return {
		getMessageAsString,
		contentType: 'text/plain',
		delimiter: '\n',
		header: '',
		footer: '',
	};
};

export const toObject = (msg: StreamMessage<any>): any => {
	return {
		streamId: msg.getStreamId(),
		streamPartition: msg.getStreamPartition(),
		timestamp: msg.getTimestamp(),
		sequenceNumber: msg.getSequenceNumber(),
		publisherId: msg.getPublisherId(),
		msgChainId: msg.getMsgChainId(),
		messageType: msg.messageType,
		contentType: msg.contentType,
		encryptionType: msg.encryptionType,
		groupKeyId: msg.groupKeyId,
		content:
			msg.encryptionType === EncryptionType.NONE
				? msg.getParsedContent()
				: msg.getSerializedContent(),
		signature: msg.signature,
	};
};

const FORMATS = {
	// TODO could we deprecate protocol format?
	// eslint-disable-next-line max-len
	protocol: createJsonFormat(
		(streamMessage: StreamMessage, version: number | undefined) =>
			JSON.stringify(streamMessage.serialize(version))
	),
	object: createJsonFormat((streamMessage: StreamMessage) =>
		JSON.stringify(toObject(streamMessage))
	),
	// the raw format message is the same string which we have we have stored to Cassandra (if the version numbers match)
	// -> TODO we could optimize the reading if we'd fetch the data from Cassandra as plain text
	// currently we:
	// 1) deserialize the string to an object in Storage._parseRow
	// 2) serialize the same object to string here
	raw: createPlainTextFormat(
		(streamMessage: StreamMessage, version: number | undefined) =>
			streamMessage.serialize(version)
	),
} satisfies Record<string, Format>;

export type FormatType = keyof typeof FORMATS;

export const getFormat = (id: string | undefined): Format => {
	const safeKey = id ?? 'object';
	const key = safeKey in FORMATS ? safeKey : 'object';
	return FORMATS[key as FormatType];
};
