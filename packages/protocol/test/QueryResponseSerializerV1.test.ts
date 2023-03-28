import assert from 'assert';

import QueryMessage, { QueryMessageType } from '../src/protocol/QueryMessage';
import QueryResponse from '../src/protocol/QueryResponse';
import '../src/protocol/QueryResponseSerializerV1';

const VERSION = 1;

// Message definitions
const message = new QueryResponse({
	version: VERSION,
	requestId: 'requestId',
	isFinal: false,
	payload: 'payload',
});

const serializedMessage = JSON.stringify([
	VERSION,
	QueryMessageType.QueryResponse,
	'requestId',
	false,
	'payload',
]);

describe('QueryResponseSerializerV1', () => {
	describe('deserialize', () => {
		it('correctly parses messages', () => {
			assert.deepStrictEqual(
				QueryMessage.deserialize(serializedMessage),
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
