import { BroadbandSubscriber } from '@logsn/broker/dist/src/shared/BroadbandSubscriber';
import { MessageMetadata } from '@logsn/client';
import {
	QueryRequest,
	QueryResponse,
	SystemMessage,
	SystemMessageType,
} from '@logsn/protocol';

type SystemMessageMap = {
	[SystemMessageType.QueryResponse]: QueryResponse;
	[SystemMessageType.QueryRequest]: QueryRequest;
};

type SystemMessageHandler<
	T extends keyof SystemMessageMap = keyof SystemMessageMap,
> = (
	message: SystemMessageMap[T],
	metadata: MessageMetadata
) => Promise<void> | void;

/**
 * The SystemMessagesGeneralHandler class is responsible for managing system messages
 * that flow through the BroadbandSubscriber. It allows dynamic addition and removal of
 * handlers for different system message types, providing a flexible way to extend functionality.
 */
export class SystemMessagesGeneralHandler {
	/**
	 * Map to store handlers for each SystemMessageType.
	 * The use of a Set ensures unique handlers for each message type.
	 * @private
	 */
	private handlersBySystemMessage = new Map<
		SystemMessageType,
		Set<SystemMessageHandler>
	>();

	constructor(private readonly subscriber: BroadbandSubscriber) {}

	/// Start receiving messages. Must be explicitly called.
	public async start() {
		await this.subscriber.subscribe(this.onMessage.bind(this));
	}

	/// Stops the subscription and clears the handlers.
	public async stop() {
		await this.subscriber.unsubscribe();
		this.handlersBySystemMessage.clear();
	}

	// ========= Add and removal of handles ========
	public addHandler<T extends keyof SystemMessageMap>(
		type: T,
		handler: SystemMessageHandler<T>
	) {
		this.handlersBySystemMessage
			.get(type)
			?.add(handler as SystemMessageHandler);
	}

	public removeHandler<T extends keyof SystemMessageMap>(
		type: T,
		handler: SystemMessageHandler<T>
	) {
		this.handlersBySystemMessage
			.get(type)
			?.delete(handler as SystemMessageHandler);
	}
	// ==============================================

	private async onMessage(content: unknown, metadata: MessageMetadata) {
		const systemMessage = SystemMessage.deserialize(content);
		const messageType = systemMessage.messageType;

		const handlers = this.handlersBySystemMessage.get(messageType);

		if (!handlers) {
			return;
		} else {
			for (const handler of handlers) {
				handler(
					systemMessage as SystemMessageMap[keyof SystemMessageMap],
					metadata
				);
			}
		}
	}
}
