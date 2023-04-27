import assert from 'assert';

import { SystemMessage, SystemMessageType } from '../src/system';
import { QueryResponse } from '../src/system/QueryResponse';
import '../src/system/QueryResponseSerializerV1';

const VERSION = 1;

// Message definitions
const message = new QueryResponse({
	version: VERSION,
	requestId: 'requestId',
	hash: 'hash',
});

const serializedMessage = JSON.stringify([
	VERSION,
	SystemMessageType.QueryResponse,
	'requestId',
	'hash',
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
