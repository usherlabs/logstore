import { MessageListener, MessageMetadata, sign } from '@logsn/client';
import { QueryPropagate, QueryResponse } from '@logsn/protocol';
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
import { QueryResponseManager } from '../../../../src/plugins/logStore/QueryResponseManager';
import { BroadbandPublisher } from '../../../../src/shared/BroadbandPublisher';
import { BroadbandSubscriber } from '../../../../src/shared/BroadbandSubscriber';

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

const msgId_1 = msg_1.getMessageID().serialize();
const msgId_2 = msg_2.getMessageID().serialize();
const msgId_3 = msg_3.getMessageID().serialize();

const msgHashMap_1: [string, string] = [msgId_1, hashMsg(msg_1)];
const msgHashMap_2: [string, string] = [msgId_2, hashMsg(msg_2)];
const msgHashMap_3: [string, string] = [msgId_3, hashMsg(msg_3)];

const msgs = {
	[msgId_1]: msg_1.serialize(),
	[msgId_2]: msg_2.serialize(),
	[msgId_3]: msg_3.serialize(),
};

const requestId = 'aaaa-bbbb-cccc';

function buildMsg(
	timestamp: number,
	sequenceNumber: number,
	publisherWallet: Wallet,
	msgChainId = '1',
	content: any = {}
) {
	const publisherId = toEthereumAddress(publisherWallet.address);
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
		seqNum: 0,
		requestId,
		requestPublisherId,
		payload: messages,
	});
}

describe(PropagationDispatcher, () => {
	let logStore: LogStore;
	let publisher: BroadbandPublisher;
	let subscriber: BroadbandSubscriber;
	let propagationDispatcher: PropagationDispatcher;
	let queryResponseManager: QueryResponseManager;

	const listeners = new Set<MessageListener>();

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

	beforeEach(async () => {
		logStore = {
			requestByMessageId: jest.fn().mockImplementation((messageId: string) => ({
				read: () => msgs[messageId],
			})),
		} as unknown as LogStore;

		publisher = {
			publish: jest.fn(),
		} as unknown as BroadbandPublisher;

		subscriber = {
			subscribe: jest.fn().mockImplementation((onMessage) => {
				listeners.add(onMessage);
			}),
			unsubscribe: async () => {
				// will destroy all, but we're ok as it happens between tests
				listeners.clear();
			},
		} satisfies Partial<BroadbandSubscriber> as unknown as BroadbandSubscriber;

		propagationDispatcher = new PropagationDispatcher(publisher);
		propagationDispatcher.start(logStore);

		const propagationResolver = new PropagationResolver(
			{
				get onlineBrokers(): [] {
					return [];
				},
			} as Partial<Heartbeat> as Heartbeat,
			subscriber
		);
		await propagationResolver.start(logStore);

		queryResponseManager = new QueryResponseManager(
			publisher,
			subscriber,
			propagationResolver,
			propagationDispatcher
		);

		queryResponseManager.start(primaryBrokerId);
	});

	afterEach(() => {
		queryResponseManager.stop();
	});

	it('do not propagate if no missing messages', async () => {
		const foreignQueryResponse = buildQueryResponse(foreignBrokerId_1, [
			msgHashMap_1,
			msgHashMap_2,
			msgHashMap_3,
		]);

		emulateQueryResponse(primaryBrokerId, foreignBrokerId_1, [
			msgHashMap_1,
			msgHashMap_2,
			msgHashMap_3,
		]);

		await propagationDispatcher.setForeignResponse(foreignQueryResponse);

		expect(publisher.publish).toBeCalledTimes(0);
	});

	it('propagates missing messages', async () => {
		const foreignQueryResponse = buildQueryResponse(foreignBrokerId_1, [
			msgHashMap_1,
			msgHashMap_2,
			msgHashMap_3,
		]);

		emulateQueryResponse(primaryBrokerId, primaryBrokerId, [
			msgHashMap_1,
			msgHashMap_2,
		]);

		await propagationDispatcher.setForeignResponse(foreignQueryResponse);

		const queryPropagate = buildQueryPropagate(primaryBrokerId, [
			[msgId_3, msg_3.serialize()],
		]);

		expect(publisher.publish).toBeCalledWith(queryPropagate.serialize());
	});
});
