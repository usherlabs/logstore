import assert from 'assert';

import '../src/protocol/QueryRequestSerializerV1';
import QueryMessage, { QueryMessageType } from '../src/protocol/QueryMessage';
import QueryRequest, { QueryType } from '../src/protocol/QueryRequest';

const VERSION = 1;

// Message definitions
const message = new QueryRequest({
	version: VERSION,
	requestId: 'requestId',
	streamId: 'streamId',
	queryType: QueryType.Last,
	queryOptions: { last: 2 },
});

const serializedMessage = JSON.stringify([
	VERSION,
	QueryMessageType.QueryRequest,
	'requestId',
	'streamId',
	QueryType.Last,
	2,
]);

// TODO: Test QueryType.From
// TODO: Test QueryType.Range
describe('QueryRequestSerializerV1', () => {
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
