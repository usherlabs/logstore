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
		seqNum: 1234,
		requestId: 'recoveryRequestId',
		payload: [],
	}),
	str: JSON.stringify([
		VERSION,
		SystemMessageType.RecoveryResponse,
		1234,
		'recoveryRequestId',
		[],
	]),
};

const testOneMessagePayload = {
	name: 'one message payload',
	obj: new RecoveryResponse({
		version: VERSION,
		seqNum: 1234,
		requestId: 'recoveryRequestId',
		payload: [
			[
				new QueryResponse({
					seqNum: 1234,
					requestId: 'queryRequestId',
					requestPublisherId: 'requestPublisherId',
					hashMap: new Map(),
				}),
				{
					streamId: 'streamId',
					streamPartition: 42,
					timestamp: 1234567890,
					sequenceNumber: 100,
					signature: Buffer.from('SIGNATURE_0002'),
					signatureType: 'ERC_1271',
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
		`1234,` +
		`"recoveryRequestId",` +
		`[` +
		`[` +
		`"[` +
		`${QueryResponse.LATEST_VERSION},` +
		`${SystemMessageType.QueryResponse},` +
		`1234,` +
		`\\"queryRequestId\\",` +
		`\\"requestPublisherId\\",` +
		`\\"[]\\"` +
		`]",` +
		`[` +
		`"streamId",` +
		`42,` +
		`1234567890,` +
		`100,` +
		`"${Buffer.from('SIGNATURE_0002').toString('base64')}",` +
		`"ERC_1271",` +
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
	describe('serialize and deserialize', () => {
		for (const test of tests) {
			it(`correctly process two way ${test.name}`, () => {
				const str = test.obj.serialize();
				const obj = SystemMessage.deserialize(str);
				assert.deepStrictEqual(obj, test.obj);
			});
		}
	});
});
