import { MessageListener, MessageMetadata } from '@logsn/client';
import { QueryPropagate, QueryResponse } from '@logsn/protocol';
import {
	createSignaturePayload,
	MessageID,
	StreamMessage,
	toStreamID,
} from '@streamr/protocol';
import { EthereumAddress, toEthereumAddress } from '@streamr/utils';
import { keccak256 } from 'ethers/lib/utils';

import { LogStore } from '../../../../src/plugins/logStore/LogStore';
import { PropagationServer } from '../../../../src/plugins/logStore/PropagationServer';
import { BroadbandPublisher } from '../../../../src/shared/BroadbandPublisher';
import { BroadbandSubscriber } from '../../../../src/shared/BroadbandSubscriber';

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

const msgs = {
	[msgId_1]: msg_1.serialize(),
	[msgId_2]: msg_2.serialize(),
	[msgId_3]: msg_3.serialize(),
};

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

describe(PropagationServer, () => {
	let logStore: LogStore;
	let publisher: BroadbandPublisher;
	let subscriber: BroadbandSubscriber;
	let propagationServer: PropagationServer;

	let subscriberOnMessage: MessageListener;

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

	beforeEach(() => {
		logStore = {
			requestPayloadByMessageId: jest
				.fn()
				.mockImplementation((messageId: string) => {
					return msgs[messageId];
				}),
		} as unknown as LogStore;

		publisher = {
			publish: jest.fn(),
		} as unknown as BroadbandPublisher;

		subscriber = {
			subscribe: jest.fn().mockImplementation((onMessage) => {
				subscriberOnMessage = onMessage;
			}),
		} as unknown as BroadbandSubscriber;

		propagationServer = new PropagationServer(logStore, publisher, subscriber);
	});

	it('do not propagate if no missing messages', async () => {
		const foreignQueryResponse = buildQueryResponse(foreignBrokerId_1, [
			msgHashMap_1,
			msgHashMap_2,
			msgHashMap_3,
		]);

		await propagationServer.start();

		emulateQueryResponse(primaryBrokerId, foreignBrokerId_1, [
			msgHashMap_1,
			msgHashMap_2,
			msgHashMap_3,
		]);

		await propagationServer.setForeignResponse(foreignQueryResponse);

		expect(publisher.publish).toBeCalledTimes(0);
	});

	it('propagates missing messages', async () => {
		const foreignQueryResponse = buildQueryResponse(foreignBrokerId_1, [
			msgHashMap_1,
			msgHashMap_2,
			msgHashMap_3,
		]);

		await propagationServer.start();

		emulateQueryResponse(primaryBrokerId, primaryBrokerId, [
			msgHashMap_1,
			msgHashMap_2,
		]);

		await propagationServer.setForeignResponse(foreignQueryResponse);

		const queryPropagate = buildQueryPropagate(primaryBrokerId, [
			[msgId_3, msg_3.serialize()],
		]);

		expect(publisher.publish).toBeCalledWith(queryPropagate.serialize());
	});
});
