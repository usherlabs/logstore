import StreamrClient from 'streamr-client';

import { createStrictConfig } from '../../src/Config';
import { generateEthereumAccount } from '../../src/Ethereum';
import { LogStoreClient } from '../../src/LogStoreClient';

describe('Config', () => {
	describe('validate', () => {
		it('additional property', () => {
			expect(() => {
				return createStrictConfig({
					foo: 'bar',
				} as any);
			}).toThrow('must NOT have additional properties: foo');
		});

		describe('invalid property format', () => {
			it('ajv-format', () => {
				expect(() => {
					return createStrictConfig({
						contracts: {
							logStoreTheGraphUrl: 'foo',
						},
					} as any);
				}).toThrow('/contracts/logStoreTheGraphUrl must match format "uri"');
			});

			it('ethereum address', () => {
				expect(() => {
					return createStrictConfig({
						contracts: {
							logStoreTokenManagerChainAddress: 'foo',
						},
					} as any);
				}).toThrow(
					'/contracts/logStoreTokenManagerChainAddress must match format "ethereum-address"'
				);
			});
		});
	});

	describe('ignorable properties', () => {
		it('auth address', () => {
			expect(() => {
				const wallet = generateEthereumAccount();
				const streamrClient = new StreamrClient({ auth: wallet });
				return new LogStoreClient(streamrClient, {});
			}).not.toThrow();
		});
	});

	describe('merging configs', () => {
		it('works with no arguments', () => {
			const streamrClient = new StreamrClient();
			expect(new LogStoreClient(streamrClient)).toBeInstanceOf(LogStoreClient);
		});
	});
});
