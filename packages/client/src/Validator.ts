/**
 * Validation Wrapper
 */
import { StreamID, StreamMessage } from '@streamr/protocol';
import { EthereumAddress } from '@streamr/utils';
import { delay, inject, Lifecycle, scoped } from 'tsyringe';

import { LogStoreClient } from './LogStoreClient';
import StreamMessageValidator from './StreamMessageValidator';
import { pOrderedResolve } from './utils/promises';
import { verify } from './utils/signingUtils';

/**
 * Wrap StreamMessageValidator in a way that ensures it can validate in parallel but
 * validation is guaranteed to resolve in the same order they were called
 * Handles caching remote calls
 */
@scoped(Lifecycle.ContainerScoped)
export class Validator extends StreamMessageValidator {
	private isStopped = false;
	private doValidation: StreamMessageValidator['validate'];

	constructor(
		// @inject(delay(() => StreamRegistryCached))
		// streamRegistryCached: StreamRegistryCached,
		@inject(delay(() => LogStoreClient)) logStoreClient: LogStoreClient
	) {
		super({
			getPartitionCount: async (streamId: StreamID) => {
				const stream = await logStoreClient.getStream(streamId);
				// const stream = await streamRegistryCached.getStream(streamId);
				return stream.getMetadata().partitions;
			},
			isPublisher: (publisherId: EthereumAddress, streamId: StreamID) => {
				return logStoreClient.isStreamPublisher(streamId, publisherId);
				// return streamRegistryCached.isStreamPublisher(streamId, publisherId);
			},
			isSubscriber: (ethAddress: EthereumAddress, streamId: StreamID) => {
				return logStoreClient.isStreamSubscriber(streamId, ethAddress);
				// return streamRegistryCached.isStreamSubscriber(streamId, ethAddress);
			},
			verify: (
				address: EthereumAddress,
				payload: string,
				signature: string
			) => {
				return verify(address, payload, signature);
			},
		});
		this.doValidation = super.validate.bind(this);
	}

	orderedValidate = pOrderedResolve(async (msg: StreamMessage) => {
		if (this.isStopped) {
			return;
		}

		// In all other cases validate using the validator
		// will throw with appropriate validation failure
		await this.doValidation(msg).catch((err: any) => {
			if (this.isStopped) {
				return;
			}

			if (!err.streamMessage) {
				err.streamMessage = msg;
			}
			throw err;
		});
	});

	override async validate(msg: StreamMessage): Promise<void> {
		if (this.isStopped) {
			return;
		}
		await this.orderedValidate(msg);
	}

	stop(): void {
		this.isStopped = true;
		this.orderedValidate.clear();
	}
}
