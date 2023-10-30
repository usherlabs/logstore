import { MessageListener, MessageMetadata, sign } from '@logsn/client';
import {
	QueryPropagate,
	QueryRequest,
	QueryResponse,
	QueryType,
} from '@logsn/protocol';
import {
	createSignaturePayload,
	MessageID,
	StreamMessage,
	toStreamID,
} from '@streamr/protocol';
import { fastWallet } from '@streamr/test-utils';
import { EthereumAddress, toEthereumAddress } from '@streamr/utils';
import { Wallet } from 'ethers';
import { keccak256 } from 'ethers/lib/utils';

import { Heartbeat } from '../../../../src/plugins/logStore/Heartbeat';
import { LogStore } from '../../../../src/plugins/logStore/LogStore';
import { PropagationDispatcher } from '../../../../src/plugins/logStore/PropagationDispatcher';
import { PropagationResolver } from '../../../../src/plugins/logStore/PropagationResolver';
import { QueryRequestManager } from '../../../../src/plugins/logStore/QueryRequestManager';
import { QueryResponseManager } from '../../../../src/plugins/logStore/QueryResponseManager';
import { BroadbandPublisher } from '../../../../src/shared/BroadbandPublisher';
import { BroadbandSubscriber } from '../../../../src/shared/BroadbandSubscriber';

const TIMEOUT = 10 * 1000;

const streamId = toStreamID('testStream');
const streamPartition = 0;
const streamPublisher = fastWallet();
const primaryBrokerId = toEthereumAddress(
	'0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
);
const foreignBrokerId_1 = toEthereumAddress(
	'0xcccccccccccccccccccccccccccccccccccccccc'
);
const foreignBrokerId_2 = toEthereumAddress(
	'0xdddddddddddddddddddddddddddddddddddddddd'
);

const msg_1 = buildMsg(100200301, 0, streamPublisher);
const msg_2 = buildMsg(100200302, 0, streamPublisher);
const msg_3 = buildMsg(100200303, 0, streamPublisher);
const msg_corrupted = buildMsg(
	100200304,
	0,
	streamPublisher,
	undefined,
	undefined,
	true
);

const msgId_1 = msg_1.getMessageID().serialize();
const msgId_2 = msg_2.getMessageID().serialize();
const msgId_3 = msg_3.getMessageID().serialize();
const msgId_corrupted = msg_corrupted.getMessageID().serialize();

const msgHashMap_1: [string, string] = [msgId_1, hashMsg(msg_1)];
const msgHashMap_2: [string, string] = [msgId_2, hashMsg(msg_2)];
const msgHashMap_3: [string, string] = [msgId_3, hashMsg(msg_3)];
const msgHashMap_corrupted: [string, string] = [
	msgId_corrupted,
	hashMsg(msg_corrupted),
];

const requestId = 'aaaa-bbbb-cccc';

function buildMsg(
	timestamp: number,
	sequenceNumber: number,
	publisherWallet: Wallet,
	msgChainId = '1',
	content: any = {},
	corrupted = false
) {
	const publisherId = toEthereumAddress(
		corrupted ? fastWallet().address : publisherWallet.address
	);
	const messageID = new MessageID(
		toStreamID(streamId),
		streamPartition,
		timestamp,
		sequenceNumber,
		publisherId,
		msgChainId
	);
	const serializedContent = JSON.stringify(content);
	const payload = createSignaturePayload({
		messageId: messageID,
		serializedContent,
	});
	const signature = sign(payload, publisherWallet.privateKey);

	return new StreamMessage({
		messageId: messageID,
		content: serializedContent,
		signature: signature,
	});
}

function hashMsg(message: StreamMessage) {
	const payload = createSignaturePayload({
		messageId: message.getMessageID(),
		serializedContent: message.getSerializedContent(),
		prevMsgRef: message.prevMsgRef ?? undefined,
		newGroupKey: message.newGroupKey ?? undefined,
	});

	return keccak256(Uint8Array.from(Buffer.from(payload)));
}

function buildQueryResponse(
	requestPublisherId: EthereumAddress,
	messages: [string, string][]
) {
	return new QueryResponse({
		requestId,
		requestPublisherId,
		hashMap: new Map<string, string>(messages),
	});
}

function buildQueryPropagate(
	requestPublisherId: EthereumAddress,
	messages: [string, string][]
) {
	return new QueryPropagate({
		requestId,
		requestPublisherId,
		payload: messages,
	});
}

describe(PropagationResolver, () => {
	let logStore: LogStore;
	let heartbeat: Heartbeat;
	let publisher: BroadbandPublisher;
	let subscriber: BroadbandSubscriber;
	let onlineBrokers: EthereumAddress[];
	let propagationResolver: PropagationResolver;
	let queryResponseManager: QueryResponseManager;
	let queryRequestManager: QueryRequestManager;

	const listeners = new Set<MessageListener>();

	const queryRequest = new QueryRequest({
		requestId,
		consumerId: primaryBrokerId,
		streamId,
		partition: streamPartition,
		queryType: QueryType.Range,
		queryOptions: {
			from: { timestamp: 100200300, sequenceNumber: 0 },
			to: { timestamp: 100200300, sequenceNumber: 0 },
		},
	});

	const broadcastToListeners = (message: string, metadata: MessageMetadata) => {
		listeners.forEach((listener) => listener(message, metadata));
	};

	const emulateQueryResponse = (
		requestPublisherId: EthereumAddress,
		responsePublisherId: EthereumAddress,
		messages: [string, string][]
	) => {
		const queryResponse = buildQueryResponse(requestPublisherId, messages);
		const metadata: MessageMetadata = {
			streamId,
			streamPartition,
			publisherId: responsePublisherId,
			timestamp: 1000,
			sequenceNumber: 0,
			msgChainId: '',
			signature: '',
		};

		broadcastToListeners(queryResponse.serialize(), metadata);
	};

	const emulateQueryPropagate = (
		requestPublisherId: EthereumAddress,
		responsePublisherId: EthereumAddress,
		messages: [string, string][]
	) => {
		const queryPropagate = buildQueryPropagate(requestPublisherId, messages);
		const metadata: MessageMetadata = {
			streamId,
			streamPartition,
			publisherId: responsePublisherId,
			timestamp: 1000,
			sequenceNumber: 0,
			msgChainId: '',
			signature: '',
		};

		broadcastToListeners(queryPropagate.serialize(), metadata);
	};

	afterEach(async () => {
		await propagationResolver.stop();
		await queryResponseManager.stop();
		await queryRequestManager.stop();
	});

	beforeEach(async () => {
		logStore = {
			store: jest.fn().mockImplementation((_message: StreamMessage) => {
				return true;
			}),
		} satisfies Partial<LogStore> as unknown as LogStore;

		heartbeat = {} satisfies Partial<Heartbeat> as unknown as Heartbeat;
		Object.defineProperty(heartbeat, 'onlineBrokers', {
			get: jest.fn().mockImplementation(() => onlineBrokers),
		});

		publisher = {
			publish: jest.fn(),
		} satisfies Partial<BroadbandPublisher> as unknown as BroadbandPublisher;

		subscriber = {
			subscribe: jest.fn().mockImplementation((onMessage) => {
				listeners.add(onMessage);
			}),
			unsubscribe: async () => {
				// will destroy all, but we're ok as it happens between tests
				listeners.clear();
			},
		} satisfies Partial<BroadbandSubscriber> as unknown as BroadbandSubscriber;

		propagationResolver = new PropagationResolver(
			logStore,
			heartbeat,
			subscriber
		);

		const propagationDispatcher = new PropagationDispatcher(
			logStore,
			publisher
		);

		queryResponseManager = new QueryResponseManager(
			publisher,
			subscriber,
			propagationResolver,
			propagationDispatcher
		);

		queryRequestManager = new QueryRequestManager(
			queryResponseManager,
			propagationResolver,
			publisher,
			subscriber
		);

		await propagationResolver.start();
		await queryResponseManager.start(primaryBrokerId);
		await queryRequestManager.start(logStore);
	});

	it(
		'resolves if the primary node is the only one broker in the network',
		async () => {
			onlineBrokers = [];

			// this runs once we await propagationResolver.propagate()
			setImmediate(() => {
				const primaryResponse = buildQueryResponse(primaryBrokerId, [
					msgHashMap_1,
					msgHashMap_2,
					msgHashMap_3,
				]);
				propagationResolver.setPrimaryResponse(primaryResponse);
			});

			await queryRequestManager.publishQueryRequestAndWaitForPropagateResolution(
				queryRequest
			);

			expect(publisher.publish).toBeCalledTimes(1);
		},
		TIMEOUT
	);

	it(
		'resolves if foreign responses match the primary response',
		async () => {
			onlineBrokers = [foreignBrokerId_1, foreignBrokerId_2];

			// this runs once we await propagationResolver.propagate()
			setImmediate(() => {
				const primaryResponse = buildQueryResponse(primaryBrokerId, [
					msgHashMap_1,
					msgHashMap_2,
					msgHashMap_3,
				]);
				propagationResolver.setPrimaryResponse(primaryResponse);

				emulateQueryResponse(primaryBrokerId, foreignBrokerId_1, [
					msgHashMap_1,
					msgHashMap_2,
					msgHashMap_3,
				]);

				emulateQueryResponse(primaryBrokerId, foreignBrokerId_2, [
					msgHashMap_1,
					msgHashMap_2,
					msgHashMap_3,
				]);
			});

			await queryRequestManager.publishQueryRequestAndWaitForPropagateResolution(
				queryRequest
			);

			expect(publisher.publish).toBeCalledTimes(1);
		},
		TIMEOUT
	);

	it(
		'resolves when propagated messages arrive',
		async () => {
			onlineBrokers = [foreignBrokerId_1, foreignBrokerId_2];

			// this runs once we await propagationResolver.propagate()
			setImmediate(() => {
				const primaryResponse = buildQueryResponse(primaryBrokerId, [
					msgHashMap_1,
				]);
				propagationResolver.setPrimaryResponse(primaryResponse);

				emulateQueryResponse(primaryBrokerId, foreignBrokerId_1, [
					msgHashMap_1,
					msgHashMap_2,
					msgHashMap_3,
				]);

				emulateQueryResponse(primaryBrokerId, foreignBrokerId_2, [
					msgHashMap_1,
					msgHashMap_2,
					msgHashMap_3,
				]);

				emulateQueryPropagate(primaryBrokerId, foreignBrokerId_1, [
					[msgId_2, msg_2.serialize()],
					[msgId_3, msg_3.serialize()],
				]);

				emulateQueryPropagate(primaryBrokerId, foreignBrokerId_1, [
					[msgId_2, msg_2.serialize()],
					[msgId_3, msg_3.serialize()],
				]);
			});

			await queryRequestManager.publishQueryRequestAndWaitForPropagateResolution(
				queryRequest
			);

			expect(logStore.store).toBeCalledTimes(2);
			expect(logStore.store).toBeCalledWith(msg_2);
			expect(logStore.store).toBeCalledWith(msg_3);
		},
		TIMEOUT
	);

	it(
		'drops propagated corrupted propagated messages',
		async () => {
			onlineBrokers = [foreignBrokerId_1, foreignBrokerId_2];

			// this runs once we await propagationResolver.propagate()
			setImmediate(() => {
				const primaryResponse = buildQueryResponse(primaryBrokerId, [
					msgHashMap_1,
				]);
				propagationResolver.setPrimaryResponse(primaryResponse);

				emulateQueryResponse(primaryBrokerId, foreignBrokerId_1, [
					msgHashMap_1,
					msgHashMap_2,
					msgHashMap_3,
				]);

				emulateQueryResponse(primaryBrokerId, foreignBrokerId_2, [
					msgHashMap_1,
					msgHashMap_2,
					msgHashMap_3,
					msgHashMap_corrupted,
				]);

				emulateQueryPropagate(primaryBrokerId, foreignBrokerId_1, [
					[msgId_2, msg_2.serialize()],
					[msgId_3, msg_3.serialize()],
				]);

				emulateQueryPropagate(primaryBrokerId, foreignBrokerId_1, [
					[msgId_2, msg_2.serialize()],
					[msgId_3, msg_3.serialize()],
					[msgId_corrupted, msg_corrupted.serialize()],
				]);
			});

			await queryRequestManager.publishQueryRequestAndWaitForPropagateResolution(
				queryRequest
			);

			expect(logStore.store).toBeCalledTimes(2);
			expect(logStore.store).toBeCalledWith(msg_2);
			expect(logStore.store).toBeCalledWith(msg_3);
			expect(logStore.store).not.toBeCalledWith(msg_corrupted);
		},
		TIMEOUT
	);

	it(
		'fails with propagation timeout',
		async () => {
			onlineBrokers = [foreignBrokerId_1];

			// this runs once we await propagationResolver.propagate()
			setImmediate(() => {
				const primaryResponse = buildQueryResponse(primaryBrokerId, [
					msgHashMap_1,
				]);
				propagationResolver.setPrimaryResponse(primaryResponse);
			});

			try {
				await queryRequestManager.publishQueryRequestAndWaitForPropagateResolution(
					queryRequest
				);
			} catch (err) {
				// yet the publish should have been called
				expect(publisher.publish).toBeCalledTimes(1);
				expect(err).toMatch('Propagation timeout');
			}
		},
		TIMEOUT
	);
});
