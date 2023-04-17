import assert from 'assert';

import {
	ProofOfMessageStored,
	SystemMessage,
	SystemMessageType,
} from '../../src/system';
import '../../src/system/ProofOfMessageStoredSerializerV1';

const VERSION = 1;

// Message definitions
const message = new ProofOfMessageStored({
	version: VERSION,
	streamId: 'streamId',
	partition: 42,
	timestamp: 1234567890,
	sequenceNumber: 100,
	size: 1000,
	hash: '01234567890abcdef',
});

const serializedMessage = JSON.stringify([
	VERSION,
	SystemMessageType.ProofOfMessageStored,
	'streamId',
	42,
	1234567890,
	100,
	1000,
	'01234567890abcdef',
]);

describe('ProofOfMessageStoredSerializerV1', () => {
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
