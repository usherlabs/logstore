import { StreamMessage } from '@streamr/protocol';
import { MarkOptional } from 'ts-essentials';

import { IPushPipeline } from '../utils/IPushPipeline';
import { MessagePipelineOptions } from './messagePipeline';

type MessagePipelineFactoryOptions = MarkOptional<
	Omit<
		MessagePipelineOptions,
		| 'resends'
		| 'groupKeyManager'
		| 'streamRegistry'
		| 'destroySignal'
		| 'loggerFactory'
	>,
	'getStorageNodes' | 'config'
>;

export interface MessagePipelineFactory {
	createMessagePipeline(
		opts: MessagePipelineFactoryOptions
	): IPushPipeline<StreamMessage, StreamMessage>;
}

export const MessagePipelineFactoryInjectionToken = Symbol(
	'MessagePipelineFactory'
);
