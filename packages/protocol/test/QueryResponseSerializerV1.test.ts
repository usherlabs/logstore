import assert from 'assert';

import { SystemMessage, SystemMessageType } from '../src/system';
import { QueryResponse } from '../src/system/QueryResponse';
import '../src/system/QueryResponseSerializerV1';

const VERSION = 1;

// Message definitions
const message = new QueryResponse({
	version: VERSION,
	requestId: 'requestId',
	size: 1024,
	hash: 'hash',
	signature: '0123456789ABCDEF',
	consumer: '0xconsumer',
	streamId: '0xstreamaddr/test',
	queryOptions: { last: 10 },
});

const serializedMessage = JSON.stringify([
	VERSION,
	SystemMessageType.QueryResponse,
	'requestId',
	1024,
	'hash',
	'0123456789ABCDEF',
	'0xconsumer',
	'0xstreamaddr/test',
	{ last: 10 },
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
