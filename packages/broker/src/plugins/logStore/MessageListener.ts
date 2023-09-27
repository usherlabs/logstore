import { LogStoreClient } from '@logsn/client';
import { StreamMessage, StreamMessageType } from '@streamr/protocol';

import { LogStore } from './LogStore';
import { LogStoreConfig } from './LogStoreConfig';

export class MessageListener {
	private logStore?: LogStore;
	private logStoreConfig?: LogStoreConfig;

	private cleanupTimer?: NodeJS.Timer;

	constructor(private readonly logStoreClient: LogStoreClient) {}

	public async start(logStore: LogStore, logStoreConfig: LogStoreConfig) {
		this.logStore = logStore;
		this.logStoreConfig = logStoreConfig;

		const node = await this.logStoreClient.getNode();
		node.addMessageListener(this.onStreamMessage.bind(this));
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

	private async onStreamMessage(msg: StreamMessage) {
		if (
			this.isStorableMessage(msg) &&
			this.logStoreConfig!.hasStreamPart(msg.getStreamPartID())
		) {
			await this.logStore!.store(msg);
		}
	}
}
