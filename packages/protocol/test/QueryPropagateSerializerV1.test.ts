import assert from 'assert';

import { SystemMessage, SystemMessageType } from '../src/system';
import { QueryPropagate } from '../src/system/QueryPropagate';
import '../src/system/QueryPropagateSerializerV1';

const VERSION = 1;

const payload: [string, string][] = [];
payload.push(['firstMessageId', 'firstMessageHash']);
payload.push(['secondeMessageId', 'secondeMessageHash']);

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
		['firstMessageId', 'firstMessageHash'],
		['secondeMessageId', 'secondeMessageHash'],
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
