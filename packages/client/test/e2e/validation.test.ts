import { fetchPrivateKeyWithGas } from '@streamr/test-utils';
import { providers, Wallet } from 'ethers';
import { catchError, firstValueFrom, of, skip, timeout } from 'rxjs';

import { CONFIG_TEST, LogStoreClient } from '../../src';
import { createTestStream } from '../test-utils/utils';

const TIMEOUT = 90 * 1000;
describe('validations', () => {
	const provider = new providers.JsonRpcProvider(
		CONFIG_TEST.contracts?.streamRegistryChainRPCs?.rpcs[0].url,
		CONFIG_TEST.contracts?.streamRegistryChainRPCs?.chainId
	);

	let account: Wallet;
	let accountClient: LogStoreClient;

	const schemaOrHash = {
		$schema: 'http://json-schema.org/draft-07/schema#',
		$id: 'test.schema.json',
		type: 'object',
		properties: {
			foo: {
				type: 'string',
			},
		},
	};

	beforeAll(async () => {
		account = new Wallet(await fetchPrivateKeyWithGas(), provider);
		console.debug('Initializing tests for: ');
		console.debug(`Account address: ${account.address}`);
		console.debug(`Account private key: ${account.privateKey}`);
		accountClient = new LogStoreClient({
			...CONFIG_TEST,
			auth: {
				privateKey: account.privateKey,
			},
		});
	}, TIMEOUT);

	afterAll(async () => {
		await Promise.allSettled([accountClient?.destroy()]);
	}, TIMEOUT);

	test(
		'set validation schema',
		async () => {
			const stream = await createTestStream(accountClient, module);

			await accountClient.setValidationSchema({
				streamId: stream.id,
				protocol: 'RAW',
				schemaOrHash: schemaOrHash,
			});

			const metadata = await accountClient.getValidationSchema({
				streamId: stream.id,
			});

			expect(metadata).toEqual(schemaOrHash);
		},
		TIMEOUT
	);

	test(
		'remove validation schema',
		async () => {
			const stream = await createTestStream(accountClient, module);

			await accountClient.setValidationSchema({
				streamId: stream.id,
				protocol: 'RAW',
				schemaOrHash: schemaOrHash,
			});

			await accountClient.removeValidationSchema({
				streamId: stream.id,
			});

			const metadata = await accountClient.getValidationSchema({
				streamId: stream.id,
			});

			expect(metadata).toBe(null);
		},
		TIMEOUT
	);

	test('validation schema works', async () => {});

	test(
		'metadataObservable works',
		async () => {
			const stream = await createTestStream(accountClient, module);

			await accountClient.setValidationSchema({
				streamId: stream.id,
				protocol: 'RAW',
				schemaOrHash: schemaOrHash,
			});

			const { metadataObservable } = accountClient.createStreamObservable(
				stream.id,
				2_000
			);

			const metadata = await firstValueFrom(metadataObservable);

			// soon we will update the metadata, then we want to ensure it's being emitted
			const secondMetadataPromise = firstValueFrom(
				metadataObservable.pipe(skip(1))
			);

			// we want to ensure if we don't change anything, nothing is being emitted here
			const inexistentThirdMetadataPromise = firstValueFrom(
				metadataObservable.pipe(
					skip(2),
					timeout(5_000),
					catchError(() => of(undefined))
				)
			);

			expect(JSON.stringify(metadata)).toInclude(JSON.stringify(schemaOrHash));

			// this should emit the new metadata
			await accountClient.removeValidationSchema({
				streamId: stream.id,
			});

			// we deleted, so we expect not to find the schema
			expect(JSON.stringify(await secondMetadataPromise)).not.toInclude(
				JSON.stringify(schemaOrHash)
			);

			// we expect nothing to be emitted here
			expect(await inexistentThirdMetadataPromise).toBe(undefined);
		},
		TIMEOUT
	);
});
