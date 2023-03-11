import { Logger, scheduleAtInterval } from '@streamr/utils';
import { Stream } from 'streamr-client';

import { LogStoreRegistry } from '../../registry/LogStoreRegistry';

const logger = new Logger(module);

/**
 * Polls full state of LogStore on an interval.
 */
export class LogStorePoller {
	private readonly pollInterval: number;
	private readonly logStoreRegistry: LogStoreRegistry;
	private readonly onNewSnapshot: (streams: Stream[], block: number) => void;

	constructor(
		pollInterval: number,
		logStoreRegistry: LogStoreRegistry,
		onNewSnapshot: (streams: Stream[], block: number) => void
	) {
		this.pollInterval = pollInterval;
		this.logStoreRegistry = logStoreRegistry;
		this.onNewSnapshot = onNewSnapshot;
	}

	async start(abortSignal: AbortSignal): Promise<void> {
		if (this.pollInterval > 0) {
			await scheduleAtInterval(
				() => this.tryPoll(),
				this.pollInterval,
				true,
				abortSignal
			);
		} else {
			await this.tryPoll();
		}
	}

	async poll(): Promise<void> {
		logger.info('polling...');
		const { streams, blockNumber } =
			await this.logStoreRegistry.getStoredStreams();
		logger.info('found %d streams at block %d', streams.length, blockNumber);
		this.onNewSnapshot(streams, blockNumber);
	}

	private async tryPoll(): Promise<void> {
		try {
			await this.poll();
		} catch (err) {
			logger.warn(`error when trying to poll full state: ${err}`);
		}
	}
}
