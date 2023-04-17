/**
 * Makes OrderingUtil more compatible with use in pipeline.
 */
import { MessageRef, StreamMessage, StreamPartID } from '@streamr/protocol';
import { EthereumAddress, Logger } from '@streamr/utils';

import { StrictLogStoreClientConfig } from '../Config';
import { MessageStream } from '../MessageStream';
import { Queries } from '../Queries';
import { LoggerFactory } from '../utils/LoggerFactory';
import { PushBuffer } from '../utils/PushBuffer';
import { Signal } from '../utils/Signal';
import OrderingUtil from './ordering/OrderingUtil';

/**
 * Wraps OrderingUtil into a PushBuffer.
 * Implements gap filling
 */
export class OrderMessages {
	private config: StrictLogStoreClientConfig;
	private queries: Queries;
	private readonly streamPartId: StreamPartID;
	private readonly logger: Logger;
	private stopSignal = Signal.once();
	private done = false;
	private queryStreams = new Set<MessageStream>(); // holds outstanding queries for cleanup
	private outBuffer = new PushBuffer<StreamMessage>();
	private inputClosed = false;
	private orderMessages: boolean;
	private enabled = true;
	private orderingUtil;

	constructor(
		config: StrictLogStoreClientConfig,
		queries: Queries,
		streamPartId: StreamPartID,
		loggerFactory: LoggerFactory
	) {
		this.config = config;
		this.queries = queries;
		this.streamPartId = streamPartId;
		this.logger = loggerFactory.createLogger(module);
		this.stopSignal.listen(() => {
			this.done = true;
		});
		this.onOrdered = this.onOrdered.bind(this);
		this.onGap = this.onGap.bind(this);
		this.maybeClose = this.maybeClose.bind(this);
		const {
			gapFillTimeout,
			retryResendAfter,
			maxGapRequests,
			orderMessages,
			gapFill,
		} = this.config;
		this.enabled = gapFill && maxGapRequests > 0;
		this.orderMessages = orderMessages;
		this.orderingUtil = new OrderingUtil(
			this.onOrdered,
			this.onGap,
			gapFillTimeout,
			retryResendAfter,
			this.enabled ? maxGapRequests : 0
		);

		this.orderingUtil.on('drain', this.maybeClose);

		// TODO: handle gapfill errors without closing stream or logging
		this.orderingUtil.on('error', this.maybeClose); // probably noop
	}

	async onGap(
		from: MessageRef,
		to: MessageRef,
		publisherId: EthereumAddress,
		msgChainId: string
	): Promise<void> {
		if (this.done || !this.enabled) {
			return;
		}
		this.logger.debug('gap detected on %j', {
			streamPartId: this.streamPartId,
			publisherId,
			msgChainId,
			from,
			to,
		});

		let resendMessageStream!: MessageStream;

		try {
			resendMessageStream = await this.queries.range(this.streamPartId, {
				fromTimestamp: from.timestamp,
				toTimestamp: to.timestamp,
				fromSequenceNumber: from.sequenceNumber,
				toSequenceNumber: to.sequenceNumber,
				publisherId,
				msgChainId,
			});
			resendMessageStream.onFinally.listen(() => {
				this.queryStreams.delete(resendMessageStream);
			});
			this.queryStreams.add(resendMessageStream);
			if (this.done) {
				return;
			}

			for await (const streamMessage of resendMessageStream.getStreamMessages()) {
				if (this.done) {
					return;
				}
				this.orderingUtil.add(streamMessage);
			}
		} catch (err) {
			if (this.done) {
				return;
			}

			if (err.code === 'NO_STORAGE_NODES') {
				// ignore NO_STORAGE_NODES errors
				// if stream has no storage we can't do queries
				this.enabled = false;
				this.orderingUtil.disable();
			} else {
				this.outBuffer.endWrite(err);
			}
		} finally {
			if (resendMessageStream != null) {
				this.queryStreams.delete(resendMessageStream);
			}
		}
	}

	onOrdered(orderedMessage: StreamMessage): void {
		if (this.outBuffer.isDone() || this.done) {
			return;
		}

		this.outBuffer.push(orderedMessage);
	}

	stop(): Promise<void> {
		return this.stopSignal.trigger();
	}

	maybeClose(): void {
		// we can close when:
		// input has closed (i.e. all messages sent)
		// AND
		// no gaps are pending
		// AND
		// gaps have been filled or failed
		// NOTE ordering util cannot have gaps if queue is empty
		if (this.inputClosed && this.orderingUtil.isEmpty()) {
			this.outBuffer.endWrite();
		}
	}

	async addToOrderingUtil(src: AsyncGenerator<StreamMessage>): Promise<void> {
		try {
			for await (const msg of src) {
				this.orderingUtil.add(msg);
			}
			this.inputClosed = true;
			this.maybeClose();
		} catch (err) {
			this.outBuffer.endWrite(err);
		}
	}

	transform(): (
		src: AsyncGenerator<StreamMessage, any, unknown>
	) => AsyncGenerator<StreamMessage> {
		return async function* Transform(
			this: OrderMessages,
			src: AsyncGenerator<StreamMessage>
		) {
			if (!this.orderMessages) {
				yield* src;
				return;
			}

			try {
				this.addToOrderingUtil(src);
				yield* this.outBuffer;
			} finally {
				this.done = true;
				this.orderingUtil.clearGaps();
				this.queryStreams.forEach((s) => s.end());
				this.queryStreams.clear();
				this.orderingUtil.clearGaps();
			}
		}.bind(this);
	}
}
