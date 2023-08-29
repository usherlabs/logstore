import assert from 'assert';

import { SystemMessage, SystemMessageType } from '../src/system';
import { RecoveryRequest } from '../src/system/RecoveryRequest';
import '../src/system/RecoveryRequestSerializerV1';

const VERSION = 1;

const message = new RecoveryRequest({
	version: VERSION,
	requestId: 'recoveryRequestId',
	from: 1234567890,
	to: 1234567890,
});

const serializedMessage = JSON.stringify([
	VERSION,
	SystemMessageType.RecoveryRequest,
	'recoveryRequestId',
	1234567890,
	1234567890,
]);

describe('RecoveryRequestSerializerV1', () => {
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
