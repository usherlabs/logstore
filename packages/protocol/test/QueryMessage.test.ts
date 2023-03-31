import assert from 'assert';
import sinon from 'sinon';

import UnsupportedTypeError from '../src/errors/UnsupportedTypeError';
import UnsupportedVersionError from '../src/errors/UnsupportedVersionError';
import ValidationError from '../src/errors/ValidationError';
import QueryMessage, { QueryMessageType } from '../src/protocol/QueryMessage';
import { Serializer } from '../src/Serializer';

const VERSION = 123;
const TYPE = 0;
const REQUEST_ID = 'requestId';

class TestQueryMessage extends QueryMessage {}

const msg = () => {
	return new TestQueryMessage(VERSION, TYPE, REQUEST_ID);
};

describe('QueryMessage', () => {
	let serializer: Serializer<QueryMessage>;

	beforeEach(() => {
		serializer = {
			fromArray: sinon.stub(),
			toArray: sinon.stub(),
		};
		QueryMessage.registerSerializer(VERSION, TYPE, serializer);
	});

	afterEach(() => {
		QueryMessage.unregisterSerializer(VERSION, TYPE);
	});

	describe('constructor', () => {
		it('is abstract', () => {
			assert.throws(
				() => new QueryMessage(VERSION, TYPE, REQUEST_ID),
				TypeError
			);
		});
		it('validates version', () => {
			assert.throws(
				() => new TestQueryMessage('invalid' as any, TYPE, REQUEST_ID),
				ValidationError
			);
		});
		it('validates type', () => {
			assert.throws(
				() => new TestQueryMessage(VERSION, 'invalid' as any, REQUEST_ID),
				ValidationError
			);
		});
		it('validates requestId', () => {
			assert.throws(
				() => new TestQueryMessage(VERSION, TYPE, null as any),
				ValidationError
			);
		});
	});

	describe('registerSerializer', () => {
		beforeEach(() => {
			// Start from a clean slate
			QueryMessage.unregisterSerializer(VERSION, TYPE);
		});

		it('registers a Serializer retrievable by getSerializer()', () => {
			QueryMessage.registerSerializer(VERSION, TYPE, serializer);
			assert.strictEqual(QueryMessage.getSerializer(VERSION, TYPE), serializer);
		});
		it('throws if the Serializer for a [version, type] is already registered', () => {
			QueryMessage.registerSerializer(VERSION, TYPE, serializer);
			assert.throws(() =>
				QueryMessage.registerSerializer(VERSION, TYPE, serializer)
			);
		});
		it('throws if the Serializer does not implement fromArray', () => {
			const invalidSerializer: any = {
				toArray: sinon.stub(),
			};
			assert.throws(() =>
				QueryMessage.registerSerializer(VERSION, TYPE, invalidSerializer)
			);
		});
		it('throws if the Serializer does not implement toArray', () => {
			const invalidSerializer: any = {
				fromArray: sinon.stub(),
			};
			assert.throws(() =>
				QueryMessage.registerSerializer(VERSION, TYPE, invalidSerializer)
			);
		});
	});

	describe('serialize', () => {
		it('calls toArray() on the configured serializer and stringifies it', () => {
			const m = msg();
			serializer.toArray = sinon.stub().returns([12345]);
			assert.strictEqual(m.serialize(), '[12345]');
			assert((serializer.toArray as any).calledWith(m));
		});

		it('should throw on unsupported version', () => {
			const m = new TestQueryMessage(999, TYPE, REQUEST_ID);
			assert.throws(
				() => m.serialize(),
				(err: UnsupportedVersionError) => {
					assert(err instanceof UnsupportedVersionError);
					assert.strictEqual(err.version, 999);
					return true;
				}
			);
		});

		it('should throw on unsupported type', () => {
			const m = new TestQueryMessage(
				VERSION,
				999 as QueryMessageType,
				REQUEST_ID
			);
			assert.throws(
				() => m.serialize(),
				(err: UnsupportedTypeError) => {
					assert(err instanceof UnsupportedTypeError);
					assert.strictEqual(err.type, 999);
					return true;
				}
			);
		});
	});

	describe('deserialize', () => {
		it('parses the input, reads version and type, and calls fromArray() on the configured serializer', () => {
			const arr = [VERSION, TYPE];
			const m = msg();
			serializer.fromArray = sinon.stub().returns(m);
			assert.strictEqual(QueryMessage.deserialize(JSON.stringify(arr)), m);
			assert((serializer.fromArray as any).calledWith(arr));
		});

		it('should throw on unsupported version', () => {
			const arr = [999, TYPE];
			assert.throws(
				() => QueryMessage.deserialize(JSON.stringify(arr)),
				(err: UnsupportedVersionError) => {
					assert(err instanceof UnsupportedVersionError);
					assert.strictEqual(err.version, 999);
					return true;
				}
			);
		});

		it('should throw on unsupported type', () => {
			const arr = [VERSION, 999];
			assert.throws(
				() => QueryMessage.deserialize(JSON.stringify(arr)),
				(err: UnsupportedTypeError) => {
					assert(err instanceof UnsupportedTypeError);
					assert.strictEqual(err.type, 999);
					return true;
				}
			);
		});
	});

	describe('getSupportedVersions', () => {
		it('returns an array of registered versions', () => {
			assert.deepStrictEqual(QueryMessage.getSupportedVersions(), [VERSION]);
		});
	});
});
