import { StreamMessage } from '@streamr/protocol';
import { Transform } from 'stream';

import { Format } from './DataQueryFormat';

const MESSAGE_LIMIT_REACHED = 'limit-reached';

// to be included only if verifyNetworkState is true
type NetworkStateVerificationMetadata = {
	participatingNodesAddress?: string[];
	requestId?: string;
};

type StreamResponseMetadata = {} & NetworkStateVerificationMetadata;

type StandardResponseMetadata = {
	hasNext: boolean;
	nextTimestamp?: number;
	nextSequenceNumber?: number;
} & NetworkStateVerificationMetadata;

export class ResponseTransform extends Transform {
	format: Format;
	version: number | undefined;
	firstMessage = true;
	totalMessages = 0;
	private metadata: StandardResponseMetadata = {
		hasNext: false,
	};

	constructor(format: Format, version: number | undefined) {
		super({
			writableObjectMode: true,
		});
		this.format = format;
		this.version = version;
	}

	override _transform(
		input: StreamMessage,
		_encoding: string,
		done: () => void
	) {
		this.totalMessages++;
		if (this.firstMessage) {
			this.firstMessage = false;
			this.push(this.format.header);
		} else {
			this.push(this.format.delimiter);
		}
		this.push(this.format.getMessageAsString(input, this.version));
		done();
	}

	setMetadata<T extends StandardResponseMetadata>(metadata: T) {
		this.metadata = metadata;
	}

	updateMetadata(
		updateFn: <T extends StandardResponseMetadata>(metadata: T) => T
	) {
		this.metadata = updateFn(this.metadata);
	}

	override _flush(done: () => void) {
		if (this.firstMessage) {
			this.push(this.format.header);
		}

		const finalChunk =
			typeof this.format.footer === 'function'
				? this.format.footer({
						...this.metadata,
						totalMessages: this.totalMessages,
				  })
				: [this.format.footer];

		finalChunk.forEach((chunk) => this.push(chunk));
		done();
	}
}

export class StreamResponseTransform extends Transform {
	format: Format;
	version: number | undefined;
	metadata: StreamResponseMetadata = {};

	constructor(format: Format, version: number | undefined) {
		super({
			writableObjectMode: true,
		});
		this.format = format;
		this.version = version;
	}

	setMetadata<T extends StreamResponseMetadata>(metadata: T): void {
		this.metadata = metadata;
	}

	updateMetadata(
		updateFn: <T extends StreamResponseMetadata>(metadata: T) => T
	) {
		this.metadata = updateFn(this.metadata);
	}

	override _flush(done: () => void) {
		const finalChunk =
			typeof this.format.footer === 'function'
				? this.format.footer(
						{
							...this.metadata,
						},
						true
				  )
				: [this.format.footer];
		finalChunk.forEach((chunk) => this.push(chunk));
		done();
	}

	override _transform(
		input: StreamMessage,
		_encoding: string,
		done: (error?: Error | null, data?: any) => void
	) {
		this.push(this.format.getMessageAsString(input, this.version));
		done();
	}
}

/**
 * A transform stream that limits the number of messages processed based on a specified limit.
 * - Provides an event handler for when the limit is reached
 * - Does not push any more data after the limit is reached
 * - Ends the stream after the limit is reached
 *
 * To disable the behavior, set the limit to Infinity.
 * @extends Transform
 */
export class MessageLimitTransform extends Transform {
	messageLimit: number;
	messageCount = 0;
	nextMessage: StreamMessage | undefined = undefined;

	constructor(messageLimit: number) {
		super({
			readableObjectMode: true,
			writableObjectMode: true,
		});
		this.messageLimit = messageLimit;
	}

	onMessageLimitReached(
		callback: (arg: {
			nextMessage: StreamMessage;
			messageLimit: number;
			messageCount: number;
		}) => void
	) {
		this.on(MESSAGE_LIMIT_REACHED, (chunk) =>
			callback({
				nextMessage: chunk,
				messageLimit: this.messageLimit,
				messageCount: this.messageCount,
			})
		);
	}

	override _transform(
		chunk: StreamMessage,
		_encoding: string,
		done: (error?: Error | null, data?: any) => void
	) {
		if (this.messageCount < this.messageLimit) {
			this.push(chunk);
			this.messageCount++;
		} else {
			this.emit(MESSAGE_LIMIT_REACHED, chunk);
			// Do not push any more data and end the stream
			this.push(null);
		}
		done();
	}
}
