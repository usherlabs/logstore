/**
 * Subscription message processing pipeline
 */
import {
	StreamMessage,
	StreamMessageError,
	StreamPartID,
} from '@streamr/protocol';

import { StrictLogStoreClientConfig } from '../Config';
import { DestroySignal } from '../DestroySignal';
import { GroupKeyManager } from '../encryption/GroupKeyManager';
import { LogStoreClient } from '../LogStoreClient';
import { MessageStream } from '../MessageStream';
import { Queries } from '../Queries';
import { LoggerFactory } from '../utils/LoggerFactory';
import { Validator } from '../Validator';
import { Decrypt } from './Decrypt';
import { MsgChainUtil } from './MsgChainUtil';
import { OrderMessages } from './OrderMessages';

export interface SubscriptionPipelineOptions {
	streamPartId: StreamPartID;
	loggerFactory: LoggerFactory;
	queries: Queries;
	logStoreClient: LogStoreClient;
	groupKeyManager: GroupKeyManager;
	destroySignal: DestroySignal;
	config: StrictLogStoreClientConfig;
}

export const createSubscribePipeline = (
	opts: SubscriptionPipelineOptions
): MessageStream => {
	const validate = new Validator(opts.logStoreClient);

	const gapFillMessages = new OrderMessages(
		opts.config,
		opts.queries,
		opts.streamPartId,
		opts.loggerFactory
	);

	/* eslint-enable object-curly-newline */

	const onError = async (
		error: Error | StreamMessageError,
		streamMessage?: StreamMessage
	) => {
		if (streamMessage) {
			ignoreMessages.add(streamMessage);
		}

		if (error && 'streamMessage' in error && error.streamMessage) {
			ignoreMessages.add(error.streamMessage);
		}

		throw error;
	};

	const decrypt = new Decrypt(
		opts.groupKeyManager,
		// opts.streamRegistryCached,
		opts.destroySignal,
		opts.loggerFactory
	);

	const messageStream = new MessageStream();
	const msgChainUtil = new MsgChainUtil(async (msg) => {
		await validate.validate(msg);
		return decrypt.decrypt(msg);
	}, messageStream.onError);

	// collect messages that fail validation/parsixng, do not push out of pipeline
	// NOTE: we let failed messages be processed and only removed at end so they don't
	// end up acting as gaps that we repeatedly try to fill.
	const ignoreMessages = new WeakSet();
	messageStream.onError.listen(onError);
	messageStream
		// order messages (fill gaps)
		.pipe(gapFillMessages.transform())
		// validate & decrypt
		.pipe(async function* (src: AsyncGenerator<StreamMessage>) {
			setImmediate(async () => {
				for await (const msg of src) {
					msgChainUtil.addMessage(msg);
				}
				await msgChainUtil.flush();
				msgChainUtil.stop();
			});
			yield* msgChainUtil;
		})
		// parse content
		.forEach(async (streamMessage: StreamMessage) => {
			streamMessage.getParsedContent();
		})
		// ignore any failed messages
		.filter(async (streamMessage: StreamMessage) => {
			return !ignoreMessages.has(streamMessage);
		})
		.onBeforeFinally.listen(async () => {
			const tasks = [gapFillMessages.stop(), validate.stop()];
			await Promise.allSettled(tasks);
		});
	return messageStream;
};
