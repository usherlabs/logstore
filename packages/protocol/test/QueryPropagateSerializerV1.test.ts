import assert from 'assert';

import { SystemMessage, SystemMessageType } from '../src/system';
import { QueryPropagate } from '../src/system/QueryPropagate';
import '../src/system/QueryPropagateSerializerV1';

const VERSION = 1;

const payload: [string, Uint8Array][] = [];
payload.push(['firstMessageId', Buffer.from('firstMessageBlob')]);
payload.push(['secondMessageId', Buffer.from('secondMessageBlob')]);

// Message definitions
const message = new QueryPropagate({
	version: VERSION,
	seqNum: 1234,
	requestId: 'requestId',
	requestPublisherId: 'requestPublisherId',
	payload,
});

const serializedMessage = JSON.stringify([
	VERSION,
	SystemMessageType.QueryPropagate,
	1234,
	'requestId',
	'requestPublisherId',
	[
		['firstMessageId', Buffer.from('firstMessageBlob').toString('base64')],
		['secondMessageId', Buffer.from('secondMessageBlob').toString('base64')],
	],
]);

describe('QueryPropagateSerializerV1', () => {
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
