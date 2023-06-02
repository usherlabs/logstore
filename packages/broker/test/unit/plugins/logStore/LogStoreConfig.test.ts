import {
	LogStoreAssignmentEvent,
	LogStoreClient,
	LogStoreClientEvents,
	Stream,
} from '@logsn/client';
import {
	StreamPartID,
	StreamPartIDUtils,
	toStreamID,
	toStreamPartID,
} from '@streamr/protocol';
import { toEthereumAddress, wait } from '@streamr/utils';
import { BigNumber } from 'ethers';
import { range } from 'lodash';

import { LogStoreConfig } from '../../../../src/plugins/logStore/LogStoreConfig';

const { parse } = StreamPartIDUtils;

const POLL_TIME = 10;

const CLUSTER_ID = toEthereumAddress(
	'0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
);

const PARTITION_COUNT_LOOKUP: Record<string, number> = Object.freeze({
	'stream-1': 2,
	'stream-2': 4,
	'stream-3': 1,
});

function makeStubStream(streamId: string): Stream {
	const partitions = PARTITION_COUNT_LOOKUP[streamId];
	return {
		id: toStreamID(streamId),
		getMetadata: () => ({
			partitions,
		}),
		getStreamParts(): StreamPartID[] {
			// TODO: duplicated code from client
			return range(0, partitions).map((p) => toStreamPartID(this.id, p));
		},
	} as Stream;
}

describe(LogStoreConfig, () => {
	let getLogStoreStreams: jest.Mock<
		Promise<{ streams: Stream[]; blockNumber: number }>,
		[]
		// [nodeAddress: EthereumAddress]
	>;
	let logStoreEventListeners: Map<
		keyof LogStoreClientEvents,
		(event: LogStoreAssignmentEvent) => void
	>;
	let stubClient: Pick<
		LogStoreClient,
		'getStream' | 'getLogStoreStreams' | 'on' | 'off'
	>;
	let onStreamPartAdded: jest.Mock<void, [StreamPartID]>;
	let onStreamPartRemoved: jest.Mock<void, [StreamPartID]>;
	let logStoreConfig: LogStoreConfig;

	beforeEach(async () => {
		getLogStoreStreams = jest.fn();
		logStoreEventListeners = new Map();
		stubClient = {
			getLogStoreStreams,
			async getStream(streamIdOrPath: string) {
				return makeStubStream(streamIdOrPath);
			},
			on(eventName: keyof LogStoreClientEvents, listener: any) {
				logStoreEventListeners.set(eventName, listener);
			},
			off(eventName: keyof LogStoreClientEvents) {
				logStoreEventListeners.delete(eventName);
			},
		};

		onStreamPartAdded = jest.fn();
		onStreamPartRemoved = jest.fn();
		logStoreConfig = new LogStoreConfig(
			// CLUSTER_ID,
			1,
			0,
			POLL_TIME,
			stubClient as LogStoreClient,
			{
				onStreamPartAdded,
				onStreamPartRemoved,
			}
		);
		getLogStoreStreams.mockRejectedValue(new Error('results not available'));
	});

	afterEach(async () => {
		await logStoreConfig?.destroy();
	});

	it('state starts empty', () => {
		expect(logStoreConfig.getStreamParts()).toBeEmpty();
	});

	describe('on polled results', () => {
		beforeEach(async () => {
			getLogStoreStreams.mockResolvedValue({
				streams: [makeStubStream('stream-1'), makeStubStream('stream-2')],
				blockNumber: 10,
			});
			await logStoreConfig.start();
			await wait(POLL_TIME * 2);
		});

		it('stream part listeners invoked', () => {
			expect(onStreamPartAdded).toBeCalledTimes(6);
			expect(onStreamPartRemoved).toBeCalledTimes(0);
			expect(onStreamPartAdded.mock.calls).toEqual([
				[parse('stream-1#0')],
				[parse('stream-1#1')],
				[parse('stream-2#0')],
				[parse('stream-2#1')],
				[parse('stream-2#2')],
				[parse('stream-2#3')],
			]);
		});

		it('state is updated', () => {
			expect(logStoreConfig.getStreamParts().size).toEqual(6);
		});
	});

	describe('on event-based results', () => {
		beforeEach(async () => {
			await logStoreConfig.start();
			const addToLogStoreListener =
				logStoreEventListeners.get('addToLogStore')!;
			const removeFromLogStoreListener =
				logStoreEventListeners.get('removeFromLogStore')!;
			addToLogStoreListener({
				store: toStreamID('stream-1'),
				isNew: true,
				amount: BigNumber.from(1000000000000000),
				blockNumber: 10,
			});
			await wait(0);
			addToLogStoreListener({
				store: toStreamID('stream-3'),
				isNew: true,
				amount: BigNumber.from(1000000000000000),
				blockNumber: 15,
			});
			await wait(0);
			removeFromLogStoreListener({
				store: toStreamID('stream-1'),
				isNew: true,
				amount: BigNumber.from(1000000000000000),
				blockNumber: 13,
			});
			await wait(0);
		});

		it('stream part listeners invoked', () => {
			expect(onStreamPartAdded).toBeCalledTimes(2 + 1);
			expect(onStreamPartRemoved).toBeCalledTimes(2);
			expect(onStreamPartAdded.mock.calls).toEqual([
				[parse('stream-1#0')],
				[parse('stream-1#1')],
				[parse('stream-3#0')],
			]);
			expect(onStreamPartRemoved.mock.calls).toEqual([
				[parse('stream-1#0')],
				[parse('stream-1#1')],
			]);
		});

		it('state is updated', () => {
			expect(logStoreConfig.getStreamParts().size).toEqual(1);
		});
	});

	it('updates do not occur if start has not been invoked', async () => {
		getLogStoreStreams.mockResolvedValue({
			streams: [makeStubStream('stream-1'), makeStubStream('stream-2')],
			blockNumber: 10,
		});
		await wait(POLL_TIME * 2);

		expect(logStoreEventListeners.size).toBe(0);
		expect(getLogStoreStreams).toHaveBeenCalledTimes(0);
		expect(onStreamPartAdded).toHaveBeenCalledTimes(0);
		expect(onStreamPartRemoved).toHaveBeenCalledTimes(0);
	});

	it('updates do not occur after destroy has been invoked', async () => {
		await logStoreConfig.start();
		await wait(POLL_TIME);
		await logStoreConfig.destroy();

		getLogStoreStreams.mockClear();
		getLogStoreStreams.mockResolvedValue({
			streams: [makeStubStream('stream-1'), makeStubStream('stream-2')],
			blockNumber: 10,
		});
		expect(logStoreEventListeners.size).toBe(0);
		await wait(POLL_TIME * 2);

		expect(getLogStoreStreams).toHaveBeenCalledTimes(0);
		expect(onStreamPartAdded).toHaveBeenCalledTimes(0);
		expect(onStreamPartRemoved).toHaveBeenCalledTimes(0);
	});
});
