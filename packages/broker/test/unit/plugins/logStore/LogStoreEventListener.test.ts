/* eslint-disable @typescript-eslint/no-shadow */
import {
	LogStoreAssignmentEvent,
	LogStoreClient,
	LogStoreClientEvents,
} from '@logsn/client';
import { toStreamID } from '@streamr/protocol';
import { wait } from '@streamr/utils';
import { BigNumber } from 'ethers';
import StreamrClient, { Stream } from 'streamr-client';

import { LogStoreEventListener } from '../../../../src/plugins/logStore/LogStoreEventListener';

const MOCK_STREAM = {
	id: 'streamId',
	getMetadata: () => ({
		partitions: 3,
	}),
} as Stream;

describe(LogStoreEventListener, () => {
	let stubStreamrClient: Pick<StreamrClient, 'getStream'>;
	let stubLogStoreClient: Pick<LogStoreClient, 'on' | 'off'>;
	const logStoreEventListeners: Map<
		keyof LogStoreClientEvents,
		(event: LogStoreAssignmentEvent) => any
	> = new Map();
	let onEvent: jest.Mock<
		void,
		[stream: Stream, type: 'added' | 'removed', block: number]
	>;
	let listener: LogStoreEventListener;

	beforeEach(() => {
		stubStreamrClient = {
			async getStream() {
				return MOCK_STREAM;
			},
		};
		stubLogStoreClient = {
			on(eventName: keyof LogStoreClientEvents, listener: any) {
				logStoreEventListeners.set(eventName, listener);
			},
			off: jest.fn(),
		};
		onEvent = jest.fn();
		listener = new LogStoreEventListener(
			stubLogStoreClient as LogStoreClient,
			stubStreamrClient as StreamrClient,
			onEvent
		);
	});

	afterEach(() => {
		listener?.destroy();
	});

	it('start() registers storage event listener on client', async () => {
		expect(logStoreEventListeners.size).toBe(0);
		await listener.start();
		expect(logStoreEventListeners.size).toBe(2);
	});

	it('destroy() unregisters storage event listener on client', async () => {
		expect(stubLogStoreClient.off).toHaveBeenCalledTimes(0);
		await listener.destroy();
		expect(stubLogStoreClient.off).toHaveBeenCalledTimes(2);
	});

	function addToLogStore() {
		logStoreEventListeners.get('addToLogStore')!({
			store: toStreamID('streamId'),
			isNew: true,
			amount: BigNumber.from(1000000000000000),
			blockNumber: 1234,
		});
	}

	it('storage node assignment event gets passed to onEvent', async () => {
		await listener.start();
		addToLogStore();
		await wait(0);
		expect(onEvent).toHaveBeenCalledTimes(1);
		expect(onEvent).toHaveBeenCalledWith(MOCK_STREAM, 'added', 1234);
	});
});
