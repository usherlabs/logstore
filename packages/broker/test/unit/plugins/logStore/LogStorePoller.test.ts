import { wait } from '@streamr/utils';
import { Stream } from 'streamr-client';

import { LogStorePoller } from '../../../../src/plugins/logStore/LogStorePoller';
import { LogStoreRegistry } from '../../../../src/registry/LogStoreRegistry';

const POLL_TIME = 5;

const POLL_RESULT = Object.freeze({
	streams: [
		{ id: 'stream-1', getMetadata: () => ({ partitions: 1 }) },
		{ id: 'stream-2', getMetadata: () => ({ partitions: 5 }) },
	] as Stream[],
	blockNumber: 13,
});

describe(LogStorePoller, () => {
	let getStoredStreams: jest.Mock<
		Promise<{ streams: Stream[]; blockNumber: number }>,
		[]
	>;
	let onNewSnapshot: jest.Mock<void, [streams: Stream[], block: number]>;
	let stubLogStoreRegistry: Pick<LogStoreRegistry, 'getStoredStreams'>;
	let poller: LogStorePoller;
	let abortController: AbortController;

	function initPoller(interval: number): LogStorePoller {
		stubLogStoreRegistry = {
			getStoredStreams,
		};
		return new LogStorePoller(
			interval,
			stubLogStoreRegistry as LogStoreRegistry,
			onNewSnapshot
		);
	}

	beforeEach(() => {
		getStoredStreams = jest.fn();
		onNewSnapshot = jest.fn();
		poller = initPoller(POLL_TIME);
		abortController = new AbortController();
	});

	afterEach(() => {
		abortController.abort();
	});

	describe('poll()', () => {
		beforeEach(async () => {
			getStoredStreams.mockResolvedValueOnce(POLL_RESULT);
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
		getStoredStreams.mockResolvedValue(POLL_RESULT);
		await poller.start(abortController.signal);
		await wait(POLL_TIME * 10);
		expect(onNewSnapshot.mock.calls.length).toBeGreaterThanOrEqual(4);
	});

	it('start() polls only once if pollInterval=0', async () => {
		getStoredStreams.mockResolvedValue(POLL_RESULT);
		poller = initPoller(0);
		await poller.start(abortController.signal);
		await wait(POLL_TIME * 10);
		expect(getStoredStreams).toBeCalledTimes(1);
	});

	it('start() handles polling errors gracefully', async () => {
		getStoredStreams.mockRejectedValue(new Error('poll failed'));
		await poller.start(abortController.signal);
		await wait(POLL_TIME * 2);
		expect(onNewSnapshot).toBeCalledTimes(0); // Should not have encountered unhandledRejectionError
	});
});
