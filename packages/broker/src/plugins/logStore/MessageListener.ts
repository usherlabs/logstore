import { LogStoreClient } from '@logsn/client';
import { LogStoreNodeManager } from '@logsn/contracts';
import {
	ProofOfMessageStored,
	SystemMessage,
	SystemMessageType,
} from '@logsn/protocol';
import { StreamMessage, StreamMessageType } from '@streamr/protocol';
import { keccak256 } from 'ethers/lib/utils';

import { BroadbandPublisher } from '../../shared/BroadbandPublisher';
import { BroadbandSubscriber } from '../../shared/BroadbandSubscriber';
import { LogStore } from './LogStore';
import { LogStoreConfig } from './LogStoreConfig';

const TTL = 60 * 1000;
const CLEANUP_INTERVAL = 60 * 1000;

interface Confirmation {
	message?: StreamMessage;
	left: number;
	ttl: number;
}

export class MessageListener {
	private logStore?: LogStore;
	private logStoreConfig?: LogStoreConfig;

	private readonly confirmations: Map<string, Confirmation>;
	private seqNum: number = 0;
	private cleanupTimer?: NodeJS.Timer;

	constructor(
		private readonly logStoreClient: LogStoreClient,
		private readonly systemSubscriber: BroadbandSubscriber,
		private readonly systemPublisher: BroadbandPublisher,
		private readonly nodeManager: LogStoreNodeManager
	) {
		this.confirmations = new Map<string, Confirmation>();
	}

	public async start(logStore: LogStore, logStoreConfig: LogStoreConfig) {
		this.logStore = logStore;
		this.logStoreConfig = logStoreConfig;

		const node = await this.logStoreClient.getNode();
		node.addMessageListener(this.onStreamMessage.bind(this));

		await this.systemSubscriber.subscribe(this.onSystemMessage.bind(this));
		this.cleanupTimer = setInterval(this.cleanup.bind(this), CLEANUP_INTERVAL);
	}

	public async stop() {
		clearInterval(this.cleanupTimer);
		const node = await this.logStoreClient.getNode();
		node.removeMessageListener(this.onStreamMessage);
		this.logStoreConfig!.getStreamParts().forEach((streamPart) => {
			node.unsubscribe(streamPart);
		});
	}

	private isStorableMessage(msg: StreamMessage): boolean {
		return msg.messageType === StreamMessageType.MESSAGE;
	}

	private async threshold() {
		const totalNode = (await this.nodeManager.totalNodes()).toNumber();
		return Math.ceil(totalNode / 2);
	}

	private async onStreamMessage(msg: StreamMessage) {
		if (
			this.isStorableMessage(msg) &&
			this.logStoreConfig!.hasStreamPart(msg.getStreamPartID())
		) {
			const size = Buffer.byteLength(msg.serialize());
			const hash = keccak256(
				Uint8Array.from(Buffer.from(msg.serialize() + size))
			);

			const threshold = await this.threshold();
			const confirmation: Confirmation = {
				message: msg,
				left: threshold,
				ttl: Date.now() + TTL,
			};
			this.confirmations.set(hash, confirmation);

			const proofOfMessageStored = new ProofOfMessageStored({
				seqNum: this.seqNum++,
				streamId: msg.getStreamId(),
				partition: msg.getStreamPartition(),
				timestamp: msg.getTimestamp(),
				sequenceNumber: msg.getSequenceNumber(),
				size,
				hash,
			});

			await this.systemPublisher.publish(proofOfMessageStored.serialize());
		}
	}

	private async onSystemMessage(content: unknown) {
		const systemMessage = SystemMessage.deserialize(content);
		if (systemMessage.messageType !== SystemMessageType.ProofOfMessageStored) {
			return;
		}

		const proof = systemMessage as ProofOfMessageStored;
		let confirmation = this.confirmations.get(proof.hash);
		if (!confirmation) {
			const threshold = await this.threshold();
			confirmation = {
				message: undefined,
				left: threshold,
				ttl: Date.now() + TTL,
			};
			this.confirmations.set(proof.hash, confirmation);
		}

		confirmation.left--;

		if (confirmation.left === 0 && confirmation.message) {
			await this.logStore!.store(confirmation.message);
		}
	}

	private cleanup() {
		for (const hash of this.confirmations.keys()) {
			if (this.confirmations.get(hash)!.ttl < Date.now()) {
				this.confirmations.delete(hash);
			}
		}
	}
}
