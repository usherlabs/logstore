import assert from 'assert';
import sinon from 'sinon';

import UnsupportedTypeError from '../../src/errors/UnsupportedTypeError';
import UnsupportedVersionError from '../../src/errors/UnsupportedVersionError';
import ValidationError from '../../src/errors/ValidationError';
import { Serializer } from '../../src/Serializer';
import { SystemMessage, SystemMessageType } from '../../src/system';

const VERSION = 123;
const TYPE = 0;

class TestSystemMessage extends SystemMessage {}

const msg = () => {
	return new TestSystemMessage(VERSION, TYPE);
};

describe('SystemMessage', () => {
	let serializer: Serializer<SystemMessage>;

	beforeEach(() => {
		serializer = {
			fromArray: sinon.stub(),
			toArray: sinon.stub(),
		};
		SystemMessage.registerSerializer(VERSION, TYPE, serializer);
	});

	afterEach(() => {
		SystemMessage.unregisterSerializer(VERSION, TYPE);
	});

	describe('constructor', () => {
		it('is abstract', () => {
			assert.throws(() => new SystemMessage(VERSION, TYPE), TypeError);
		});
		it('validates version', () => {
			assert.throws(
				() => new TestSystemMessage('invalid' as any, TYPE),
				ValidationError
			);
		});
		it('validates type', () => {
			assert.throws(
				() => new TestSystemMessage(VERSION, 'invalid' as any),
				ValidationError
			);
		});
	});

	describe('registerSerializer', () => {
		beforeEach(() => {
			// Start from a clean slate
			SystemMessage.unregisterSerializer(VERSION, TYPE);
		});

		it('registers a Serializer retrievable by getSerializer()', () => {
			SystemMessage.registerSerializer(VERSION, TYPE, serializer);
			assert.strictEqual(
				SystemMessage.getSerializer(VERSION, TYPE),
				serializer
			);
		});
		it('throws if the Serializer for a [version, type] is already registered', () => {
			SystemMessage.registerSerializer(VERSION, TYPE, serializer);
			assert.throws(() =>
				SystemMessage.registerSerializer(VERSION, TYPE, serializer)
			);
		});
		it('throws if the Serializer does not implement fromArray', () => {
			const invalidSerializer: any = {
				toArray: sinon.stub(),
			};
			assert.throws(() =>
				SystemMessage.registerSerializer(VERSION, TYPE, invalidSerializer)
			);
		});
		it('throws if the Serializer does not implement toArray', () => {
			const invalidSerializer: any = {
				fromArray: sinon.stub(),
			};
			assert.throws(() =>
				SystemMessage.registerSerializer(VERSION, TYPE, invalidSerializer)
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
			const m = new TestSystemMessage(999, TYPE);
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
			const m = new TestSystemMessage(VERSION, 999 as SystemMessageType);
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
			assert.strictEqual(SystemMessage.deserialize(JSON.stringify(arr)), m);
			assert((serializer.fromArray as any).calledWith(arr));
		});

		it('should throw on unsupported version', () => {
			const arr = [999, TYPE];
			assert.throws(
				() => SystemMessage.deserialize(JSON.stringify(arr)),
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
				() => SystemMessage.deserialize(JSON.stringify(arr)),
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
			assert.deepStrictEqual(SystemMessage.getSupportedVersions(), [VERSION]);
		});
	});
});
