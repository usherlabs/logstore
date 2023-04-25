import { EncryptionType, StreamMessage } from '@streamr/protocol';
import { Logger } from '@streamr/utils';

import { DestroySignal } from '../DestroySignal';
import { DecryptError, EncryptionUtil } from '../encryption/EncryptionUtil';
import { GroupKey } from '../encryption/GroupKey';
import { GroupKeyManager } from '../encryption/GroupKeyManager';
import { LoggerFactory } from '../utils/LoggerFactory';

export class Decrypt {
	private groupKeyManager: GroupKeyManager;
	private destroySignal: DestroySignal;
	private readonly logger: Logger;

	constructor(
		groupKeyManager: GroupKeyManager,
		destroySignal: DestroySignal,
		loggerFactory: LoggerFactory
	) {
		this.groupKeyManager = groupKeyManager;
		this.destroySignal = destroySignal;
		this.logger = loggerFactory.createLogger(module);
		this.decrypt = this.decrypt.bind(this);
	}

	async decrypt(streamMessage: StreamMessage): Promise<StreamMessage> {
		if (this.destroySignal.isDestroyed()) {
			return streamMessage;
		}

		if (!streamMessage.groupKeyId) {
			return streamMessage;
		}

		if (streamMessage.encryptionType !== EncryptionType.AES) {
			return streamMessage;
		}

		try {
			let groupKey: GroupKey | undefined;
			try {
				groupKey = await this.groupKeyManager.fetchKey(
					streamMessage.getStreamPartID(),
					streamMessage.groupKeyId,
					streamMessage.getPublisherId()
				);
			} catch (e: any) {
				if (this.destroySignal.isDestroyed()) {
					return streamMessage;
				}
				throw new DecryptError(
					streamMessage,
					`Could not get GroupKey ${streamMessage.groupKeyId}: ${e.message}`
				);
			}
			if (this.destroySignal.isDestroyed()) {
				return streamMessage;
			}

			const clone = StreamMessage.deserialize(streamMessage.serialize());
			EncryptionUtil.decryptStreamMessage(clone, groupKey);
			if (streamMessage.newGroupKey) {
				// newGroupKey has been converted into GroupKey
				await this.groupKeyManager.addKeyToLocalStore(
					clone.newGroupKey as unknown as GroupKey,
					streamMessage.getStreamId()
				);
			}
			return clone;
		} catch (err) {
			this.logger.debug(
				'failed to decrypt message %j, reason: %s',
				streamMessage.getMessageID(),
				err
			);
			throw err;
		}
	}
}
