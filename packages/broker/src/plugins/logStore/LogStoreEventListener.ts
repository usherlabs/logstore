import {
	LogStoreAssignmentEvent,
	LogStoreClient,
} from '@concertodao/logstore-client';
import { Logger } from '@streamr/utils';
import { Stream } from 'streamr-client';

const logger = new Logger(module);

/**
 * Hooks up to StreamrClient event listener to learn about
 * stream assignment and removal events in real-time.
 */
export class LogStoreEventListener {
	private readonly logStoreClient: LogStoreClient;
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
		logStoreClient: LogStoreClient,
		onEvent: (stream: Stream, type: 'added' | 'removed', block: number) => void
	) {
		this.logStoreClient = logStoreClient;
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
			const stream = await this.logStoreClient.getStream(event.store);
			this.onEvent(stream, type, event.blockNumber);
		} catch (e) {
			logger.warn('chainEventsListener: %s', e);
		}
	}

	async start(): Promise<void> {
		this.logStoreClient.on('addToLogStore', this.onAddToLogStore);
		this.logStoreClient.on('removeFromLogStore', this.onRemoveFromLogStore);
	}

	async destroy(): Promise<void> {
		this.logStoreClient.off('addToLogStore', this.onAddToLogStore);
		this.logStoreClient.off('removeFromLogStore', this.onRemoveFromLogStore);
	}
}
