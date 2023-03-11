import { Logger } from '@streamr/utils';
import { Stream, StreamrClient } from 'streamr-client';

import {
	LogStoreAssignmentEvent,
	LogStoreRegistry,
} from '../../registry/LogStoreRegistry';

const logger = new Logger(module);

/**
 * Hooks up to StreamrClient event listener to learn about
 * stream assignment and removal events in real-time.
 */
export class LogStoreEventListener {
	private readonly streamrClient: StreamrClient;
	private readonly logStoreRegistry: LogStoreRegistry;
	private readonly onEvent: (
		stream: Stream,
		type: 'added' | 'removed',
		block: number
	) => void;
	private readonly onAddToLogStore: (event: LogStoreAssignmentEvent) => void;
	private readonly onRemoveFromLogStore: (
		event: LogStoreAssignmentEvent
	) => void;

	constructor(
		streamrClient: StreamrClient,
		logStoreRegistry: LogStoreRegistry,
		onEvent: (stream: Stream, type: 'added' | 'removed', block: number) => void
	) {
		this.streamrClient = streamrClient;
		this.logStoreRegistry = logStoreRegistry;
		this.onEvent = onEvent;
		this.onAddToLogStore = (event: LogStoreAssignmentEvent) =>
			this.handleEvent(event, 'added');
		this.onRemoveFromLogStore = (event: LogStoreAssignmentEvent) =>
			this.handleEvent(event, 'removed');
	}

	private async handleEvent(
		event: LogStoreAssignmentEvent,
		type: 'added' | 'removed'
	) {
		logger.info('received LogStoreAssignmentEvent type=%s: %j', type, event);
		try {
			const stream = await this.streamrClient.getStream(event.store);
			this.onEvent(stream, type, event.blockNumber);
		} catch (e) {
			logger.warn('chainEventsListener: %s', e);
		}
	}

	async start(): Promise<void> {
		this.logStoreRegistry.on('addToLogStore', this.onAddToLogStore);
		this.logStoreRegistry.on('removeFromLogStore', this.onRemoveFromLogStore);
	}

	async destroy(): Promise<void> {
		this.logStoreRegistry.off('addToLogStore', this.onAddToLogStore);
		this.logStoreRegistry.off('removeFromLogStore', this.onRemoveFromLogStore);
	}
}
