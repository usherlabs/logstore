import assert from 'assert';

import { MessageRef } from '@streamr/protocol';
import { SystemMessage, SystemMessageType } from '../src/system';
import { QueryResponse } from '../src/system/QueryResponse';
import '../src/system/QueryResponseSerializerV1';

const VERSION = 1;

const messageRef: MessageRef[] = [];
messageRef.push(new MessageRef(100200301, 1));
messageRef.push(new MessageRef(100200302, 2));

// Message definitions
const message = new QueryResponse({
	version: VERSION,
	seqNum: 1234,
	requestId: 'requestId',
	requestPublisherId: 'requestPublisherId',
	isFinal: true,
	messageRefs: messageRef,
});

const serializedMessage = JSON.stringify([
	VERSION,
	SystemMessageType.QueryResponse,
	1234,
	'requestId',
	'requestPublisherId',
	true,
	'[[100200301,1],[100200302,2]]',
]);

describe('QueryResponseSerializerV1', () => {
	describe('deserialize', () => {
		it('correctly parses messages', () => {
			assert.deepStrictEqual(
				SystemMessage.deserialize(serializedMessage),
				message
			);
		});
	});
	describe('serialize', () => {
		it('correctly serializes messages', () => {
			assert.deepStrictEqual(message.serialize(VERSION, 32), serializedMessage);
		});
	});
});
