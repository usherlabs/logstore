import { toStreamID } from '@streamr/protocol';
import { wait } from '@streamr/utils';
import { BigNumber } from 'ethers';
import { Stream, StreamrClient } from 'streamr-client';

import { LogStoreClientEvents } from '../../../../src/client/events';
import { LogStoreEventListener } from '../../../../src/plugins/logStore/LogStoreEventListener';
import {
	LogStoreAssignmentEvent,
	LogStoreRegistry,
} from '../../../../src/registry/LogStoreRegistry';

const MOCK_STREAM = {
	id: 'streamId',
	getMetadata: () => ({
		partitions: 3,
	}),
} as Stream;

describe(LogStoreEventListener, () => {
	let stubClient: Pick<StreamrClient, 'getStream'>;
	let stubLogStoreRegistry: Pick<LogStoreRegistry, 'on' | 'off'>;
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
		stubClient = {
			async getStream() {
				return MOCK_STREAM;
			},
		};
		stubLogStoreRegistry = {
			on(eventName: keyof LogStoreClientEvents, listener: any) {
				logStoreEventListeners.set(eventName, listener);
			},
			off: jest.fn(),
		};
		onEvent = jest.fn();
		listener = new LogStoreEventListener(
			stubClient as StreamrClient,
			stubLogStoreRegistry as LogStoreRegistry,
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
		expect(stubLogStoreRegistry.off).toHaveBeenCalledTimes(0);
		await listener.destroy();
		expect(stubLogStoreRegistry.off).toHaveBeenCalledTimes(2);
	});

	function addToLogStore() {
		logStoreEventListeners.get('addToLogStore')!({
			store: toStreamID('streamId'),
			isNew: true,
			address: toStreamID('updated-by-1'),
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
