import assert from 'assert';

import { SystemMessage, SystemMessageType } from '../src/system';
import { QueryPropagate } from '../src/system/QueryPropagate';
import '../src/system/QueryPropagateSerializerV1';

const VERSION = 1;

const payload: Uint8Array[] = [];
payload.push(new Uint8Array([1, 2, 3]));
payload.push(new Uint8Array([3, 2, 1]));

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
		Buffer.from([1, 2, 3]).toString('base64'),
		Buffer.from([3, 2, 1]).toString('base64'),
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
