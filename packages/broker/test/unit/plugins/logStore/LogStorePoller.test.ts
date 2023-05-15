import { LogStoreClient } from '@concertodao/logstore-client';
import { Stream } from '@concertodao/streamr-client';
import { wait } from '@streamr/utils';

import { LogStorePoller } from '../../../../src/plugins/logStore/LogStorePoller';

const POLL_TIME = 5;

const POLL_RESULT = Object.freeze({
	streams: [
		{ id: 'stream-1', getMetadata: () => ({ partitions: 1 }) },
		{ id: 'stream-2', getMetadata: () => ({ partitions: 5 }) },
	] as Stream[],
	blockNumber: 13,
});

describe(LogStorePoller, () => {
	let getLogStoreStreams: jest.Mock<
		Promise<{ streams: Stream[]; blockNumber: number }>,
		[]
	>;
	let onNewSnapshot: jest.Mock<void, [streams: Stream[], block: number]>;
	let stubClient: Pick<LogStoreClient, 'getLogStoreStreams'>;

	let poller: LogStorePoller;
	let abortController: AbortController;

	function initPoller(interval: number): LogStorePoller {
		return new LogStorePoller(
			interval,
			stubClient as LogStoreClient,
			onNewSnapshot
		);
	}

	beforeEach(() => {
		getLogStoreStreams = jest.fn();
		onNewSnapshot = jest.fn();
		stubClient = { getLogStoreStreams };
		poller = initPoller(POLL_TIME);
		abortController = new AbortController();
	});

	afterEach(() => {
		abortController.abort();
	});

	describe('poll()', () => {
		beforeEach(async () => {
			getLogStoreStreams.mockResolvedValueOnce(POLL_RESULT);
			await poller.poll();
		});

		it('stream assignment result set is passed to onNewSnapshot callback', () => {
			expect(onNewSnapshot).toHaveBeenCalledTimes(1);
			expect(onNewSnapshot).toHaveBeenCalledWith(
				POLL_RESULT.streams,
				POLL_RESULT.blockNumber
			);
		});
	});

	it('start() schedules polling on an interval', async () => {
		getLogStoreStreams.mockResolvedValue(POLL_RESULT);
		await poller.start(abortController.signal);
		await wait(POLL_TIME * 10);
		expect(onNewSnapshot.mock.calls.length).toBeGreaterThanOrEqual(4);
	});

	it('start() polls only once if pollInterval=0', async () => {
		getLogStoreStreams.mockResolvedValue(POLL_RESULT);
		poller = initPoller(0);
		await poller.start(abortController.signal);
		await wait(POLL_TIME * 10);
		expect(getLogStoreStreams).toBeCalledTimes(1);
	});

	it('start() handles polling errors gracefully', async () => {
		getLogStoreStreams.mockRejectedValue(new Error('poll failed'));
		await poller.start(abortController.signal);
		await wait(POLL_TIME * 2);
		expect(onNewSnapshot).toBeCalledTimes(0); // Should not have encountered unhandledRejectionError
	});
});
