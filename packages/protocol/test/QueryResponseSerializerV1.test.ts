import assert from 'assert';

import { SystemMessage, SystemMessageType } from '../src/system';
import { QueryResponse } from '../src/system/QueryResponse';
import '../src/system/QueryResponseSerializerV1';

const VERSION = 1;

const hashMap = new Map<string, string>();
hashMap.set('firstMessageId', 'firstMessageHash');
hashMap.set('secondeMessageId', 'secondeMessageHash');

// Message definitions
const message = new QueryResponse({
	version: VERSION,
	seqNum: 1234,
	requestId: 'requestId',
	requestPublisherId: 'requestPublisherId',
	hashMap,
});

const serializedMessage = JSON.stringify([
	VERSION,
	SystemMessageType.QueryResponse,
	1234,
	'requestId',
	'requestPublisherId',
	'[["firstMessageId","firstMessageHash"],["secondeMessageId","secondeMessageHash"]]',
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
