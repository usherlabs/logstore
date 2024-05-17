import assert from 'assert';

import { SystemMessage, SystemMessageType } from '../src/system';
import { QueryRequest, QueryType } from '../src/system/QueryRequest';
import '../src/system/QueryRequestSerializerV1';

const VERSION = 1;

// Message definitions
const message = new QueryRequest({
	version: VERSION,
	seqNum: 1234,
	requestId: 'requestId',
	consumerId: 'consumerId',
	streamId: 'streamId',
	partition: 42,
	queryOptions: {
		queryType: QueryType.Last,
		last: 2
	},
});

const serializedMessage = JSON.stringify([
	VERSION,
	SystemMessageType.QueryRequest,
	1234,
	'requestId',
	'consumerId',
	'streamId',
	42,
	QueryType.Last,
	2,
]);

// TODO: Test QueryType.From
// TODO: Test QueryType.Range
describe('QueryRequestSerializerV1', () => {
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
