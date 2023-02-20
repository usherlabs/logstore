import { Logger, scheduleAtInterval } from '@streamr/utils';
import { Stream, StreamrClient } from 'streamr-client';

const logger = new Logger(module);

/**
 * Polls full state of LogStore node assignments on an interval.
 */
export class LogStorePoller {
	private readonly clusterId: string;
	private readonly pollInterval: number;
	private readonly streamrClient: StreamrClient;
	private readonly onNewSnapshot: (streams: Stream[], block: number) => void;

	constructor(
		clusterId: string,
		pollInterval: number,
		streamrClient: StreamrClient,
		onNewSnapshot: (streams: Stream[], block: number) => void
	) {
		this.clusterId = clusterId;
		this.pollInterval = pollInterval;
		this.streamrClient = streamrClient;
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
		const { streams, blockNumber } = await this.streamrClient.getStoredStreams(
			this.clusterId
		);
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
