import assert from 'assert';

import { MessageMetadata } from '../src/interfaces/MessageMetadata';
import { QueryResponse, SystemMessage, SystemMessageType } from '../src/system';
import '../src/system/QueryResponseSerializerV1';
import { RecoveryResponse } from '../src/system/RecoveryResponse';
import '../src/system/RecoveryResponseSerializerV1';

const VERSION = 1;

interface Test {
	name: string;
	obj: RecoveryResponse;
	str: string;
}

const testEmptyPayload = {
	name: 'empty payload',
	obj: new RecoveryResponse({
		version: VERSION,
		requestId: 'recoveryRequestId',
		payload: [],
	}),
	str: JSON.stringify([
		VERSION,
		SystemMessageType.RecoveryResponse,
		'recoveryRequestId',
		[],
	]),
};

const testOneMessagePayload = {
	name: 'one message payload',
	obj: new RecoveryResponse({
		version: VERSION,
		requestId: 'recoveryRequestId',
		payload: [
			[
				new QueryResponse({
					requestId: 'queryRequestId',
					size: 1024,
					hash: 'HASH_0001',
					signature: 'SIGNATURE_0001',
				}),
				{
					streamId: 'streamId',
					streamPartition: 42,
					timestamp: 1234567890,
					sequenceNumber: 100,
					signature: 'SIGNATURE_0002',
					publisherId: 'PUBLISHER_0001',
					msgChainId: 'MSGCHAIN_0001',
				} as MessageMetadata,
			],
		],
	}),
	str:
		`[` +
		`${VERSION},` +
		`${SystemMessageType.RecoveryResponse},` +
		`"recoveryRequestId",` +
		`[` +
		`[` +
		`"[` +
		`${QueryResponse.LATEST_VERSION},` +
		`${SystemMessageType.QueryResponse},` +
		`\\"queryRequestId\\",` +
		`1024,` +
		`\\"HASH_0001\\",` +
		`\\"SIGNATURE_0001\\"` +
		`]",` +
		`[` +
		`"streamId",` +
		`42,` +
		`1234567890,` +
		`100,` +
		`"SIGNATURE_0002",` +
		`"PUBLISHER_0001",` +
		`"MSGCHAIN_0001"` +
		`]` +
		`]` +
		`]` +
		`]`,
};

const tests: Test[] = [testEmptyPayload, testOneMessagePayload];

describe('RecoveryResponseSerializerV1', () => {
	describe('deserialize', () => {
		for (const test of tests) {
			it(`correctly parses ${test.name}`, () => {
				const obj = SystemMessage.deserialize(test.str);
				assert.deepStrictEqual(obj, test.obj);
			});
		}
	});
	describe('serialize', () => {
		for (const test of tests) {
			it(`correctly serializes ${test.name}`, () => {
				const str = test.obj.serialize();
				assert.equal(str, test.str);
			});
		}
	});
	describe('serialize as deserialize', () => {
		for (const test of tests) {
			it(`correctly process two way ${test.name}`, () => {
				const str = test.obj.serialize();
				const obj = SystemMessage.deserialize(str);
				assert.deepStrictEqual(obj, test.obj);
			});
		}
	});
});