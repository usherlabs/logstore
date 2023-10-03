import { MessageListener, MessageMetadata } from '@logsn/client';
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
import { EthereumAddress, toEthereumAddress } from '@streamr/utils';
import { keccak256 } from 'ethers/lib/utils';

import { Heartbeat } from '../../../../src/plugins/logStore/Heartbeat';
import { LogStore } from '../../../../src/plugins/logStore/LogStore';
import { PropagationClient } from '../../../../src/plugins/logStore/PropagationClient';
import { BroadbandPublisher } from '../../../../src/shared/BroadbandPublisher';
import { BroadbandSubscriber } from '../../../../src/shared/BroadbandSubscriber';

const TIMEOUT = 10 * 1000;

const streamId = toStreamID('testStream');
const streamPartition = 0;
const streamPublisher = toEthereumAddress(
	'0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
);
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

const msgId_1 = msg_1.getMessageID().serialize();
const msgId_2 = msg_2.getMessageID().serialize();
const msgId_3 = msg_3.getMessageID().serialize();

const msgHashMap_1: [string, string] = [msgId_1, hashMsg(msg_1)];
const msgHashMap_2: [string, string] = [msgId_2, hashMsg(msg_2)];
const msgHashMap_3: [string, string] = [msgId_3, hashMsg(msg_3)];

const requestId = 'aaaa-bbbb-cccc';

function buildMsg(
	timestamp: number,
	sequenceNumber: number,
	publisherId: EthereumAddress,
	msgChainId = '1',
	content: any = {}
) {
	return new StreamMessage({
		messageId: new MessageID(
			toStreamID(streamId),
			streamPartition,
			timestamp,
			sequenceNumber,
			publisherId,
			msgChainId
		),
		content: JSON.stringify(content),
		signature: 'signature',
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
		seqNum: 0,
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
		seqNum: 0,
		requestId,
		requestPublisherId,
		payload: messages,
	});
}

describe(PropagationClient, () => {
	let logStore: LogStore;
	let heartbeat: Heartbeat;
	let publisher: BroadbandPublisher;
	let subscriber: BroadbandSubscriber;
	let onlineBrokers: EthereumAddress[];
	let propagationClient: PropagationClient;

	let subscriberOnMessage: MessageListener;

	const queryRequest = new QueryRequest({
		seqNum: 0,
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

		subscriberOnMessage(queryResponse.serialize(), metadata);
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

		subscriberOnMessage(queryPropagate.serialize(), metadata);
	};

	beforeEach(async () => {
		logStore = {
			store: jest.fn().mockImplementation((_message: StreamMessage) => {
				return true;
			}),
		} as unknown as LogStore;

		heartbeat = {} as unknown as Heartbeat;
		Object.defineProperty(heartbeat, 'onlineBrokers', {
			get: jest.fn().mockImplementation(() => onlineBrokers),
		});

		publisher = {
			publish: jest.fn(),
		} as unknown as BroadbandPublisher;

		subscriber = {
			subscribe: jest.fn().mockImplementation((onMessage) => {
				subscriberOnMessage = onMessage;
			}),
		} as unknown as BroadbandSubscriber;

		propagationClient = new PropagationClient(
			logStore,
			heartbeat,
			publisher,
			subscriber
		);

		await propagationClient.start();
	});

	it(
		'resolves if the primary node is the only one broker in the network',
		async () => {
			onlineBrokers = [];

			// this runs once we await propagationClient.propagate()
			setImmediate(() => {
				const primaryResponse = buildQueryResponse(primaryBrokerId, [
					msgHashMap_1,
					msgHashMap_2,
					msgHashMap_3,
				]);
				propagationClient.setPrimaryResponse(primaryResponse);
			});

			await propagationClient.propagate(queryRequest);

			expect(publisher.publish).toBeCalledTimes(1);
		},
		TIMEOUT
	);

	it(
		'resolves if foreign responses match the primary response',
		async () => {
			onlineBrokers = [foreignBrokerId_1, foreignBrokerId_2];

			// this runs once we await propagationClient.propagate()
			setImmediate(() => {
				const primaryResponse = buildQueryResponse(primaryBrokerId, [
					msgHashMap_1,
					msgHashMap_2,
					msgHashMap_3,
				]);
				propagationClient.setPrimaryResponse(primaryResponse);

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

			await propagationClient.propagate(queryRequest);

			expect(publisher.publish).toBeCalledTimes(1);
		},
		TIMEOUT
	);

	it(
		'resolves when propagated messages arrive',
		async () => {
			onlineBrokers = [foreignBrokerId_1, foreignBrokerId_2];

			// this runs once we await propagationClient.propagate()
			setImmediate(() => {
				const primaryResponse = buildQueryResponse(primaryBrokerId, [
					msgHashMap_1,
				]);
				propagationClient.setPrimaryResponse(primaryResponse);

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

			await propagationClient.propagate(queryRequest);

			expect(logStore.store).toBeCalledTimes(2);
			expect(logStore.store).toBeCalledWith(msg_2);
			expect(logStore.store).toBeCalledWith(msg_3);
		},
		TIMEOUT
	);

	it(
		'fails with propagation timeout',
		async () => {
			onlineBrokers = [foreignBrokerId_1];

			// this runs once we await propagationClient.propagate()
			setImmediate(() => {
				const primaryResponse = buildQueryResponse(primaryBrokerId, [
					msgHashMap_1,
				]);
				propagationClient.setPrimaryResponse(primaryResponse);
			});

			try {
				await propagationClient.propagate(queryRequest);
			} catch (err) {
				expect(err).toMatch('Propagation timeout');
			}
		},
		TIMEOUT
	);
});
