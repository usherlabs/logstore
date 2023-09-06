import assert from 'assert';

import { SystemMessage, SystemMessageType } from '../src/system';
import { RecoveryComplete } from '../src/system/RecoveryComplete';
import '../src/system/RecoveryCompleteSerializerV1';

const VERSION = 1;

const message = new RecoveryComplete({
	version: VERSION,
	seqNum: 1234,
	requestId: 'recoveryRequestId',
	isFulfilled: true,
});

const serializedMessage = JSON.stringify([
	VERSION,
	SystemMessageType.RecoveryComplete,
	1234,
	'recoveryRequestId',
	true,
]);

describe('RecoveryCompleteSerializerV1', () => {
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
			assert.deepStrictEqual(message.serialize(), serializedMessage);
		});
	});
});
