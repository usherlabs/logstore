import {
	CONFIG_TEST as STREAMR_CONFIG_TEST,
	StreamrClient,
} from '@streamr/sdk';
import { fetchPrivateKeyWithGas } from '@streamr/test-utils';
import { Wallet } from 'ethers';
import { firstValueFrom, skip } from 'rxjs';

import { LogStoreClient } from '../../src';
import { sleep } from '../test-utils/sleep';
import { createTestStream, getProvider } from '../test-utils/utils';

const TIMEOUT = 90 * 1000;
describe('validations', () => {
	const provider = getProvider();

	let account: Wallet;
	let accountStreamrClient: StreamrClient;
	let accountLogStoreClient: LogStoreClient;

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
		accountStreamrClient = new StreamrClient({
			...STREAMR_CONFIG_TEST,
			auth: {
				privateKey: account.privateKey,
			},
		});
		accountLogStoreClient = new LogStoreClient(accountStreamrClient);
	}, TIMEOUT);

	afterAll(async () => {
		await Promise.allSettled([
			accountStreamrClient?.destroy(),
			accountLogStoreClient?.destroy(),
		]);
	}, TIMEOUT);

	test(
		'set validation schema',
		async () => {
			const stream = await createTestStream(accountStreamrClient, module);

			await accountLogStoreClient.setValidationSchema({
				streamId: stream.id,
				protocol: 'RAW',
				schemaOrHash: schemaOrHash,
			});

			const metadata = await accountLogStoreClient.getValidationSchema({
				streamId: stream.id,
			});

			expect(metadata).toEqual(schemaOrHash);
		},
		TIMEOUT
	);

	test(
		'remove validation schema',
		async () => {
			const stream = await createTestStream(accountStreamrClient, module);

			await accountLogStoreClient.setValidationSchema({
				streamId: stream.id,
				protocol: 'RAW',
				schemaOrHash: schemaOrHash,
			});

			await accountLogStoreClient.removeValidationSchema({
				streamId: stream.id,
			});

			const metadata = await accountLogStoreClient.getValidationSchema({
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
			const stream = await createTestStream(accountStreamrClient, module);

			const { metadataObservable } =
				accountLogStoreClient.createStreamObservable(stream.id, 2_000);

			const waitForNthMetadata = (n: number) =>
				firstValueFrom(metadataObservable.pipe(skip(n)));

			// this promises we start right now, so we can collect it in order, as they come

			// first time we set the schema
			const firsSchemaChangePromise = waitForNthMetadata(1);
			// for when we delete the metadata, changing it
			const secondSchemaChangePromise = waitForNthMetadata(2);
			// we want to ensure if we don't change anything, nothing is being emitted here
			const inexistentThirdSchemaChangePromise = secondSchemaChangePromise.then(
				() => {
					// a promise that starts only after second change
					return new Promise((resolve, reject) => {
						waitForNthMetadata(3).then(reject);
						sleep(5_000).then(resolve);
					});
				}
			);

			// just ensuring the default metadata is already there
			await waitForNthMetadata(0);

			await accountLogStoreClient.setValidationSchema({
				streamId: stream.id,
				protocol: 'RAW',
				schemaOrHash: schemaOrHash,
			});

			expect(JSON.stringify(await firsSchemaChangePromise)).toInclude(
				JSON.stringify(schemaOrHash)
			);

			// this should emit the new metadata
			await accountLogStoreClient.removeValidationSchema({
				streamId: stream.id,
			});

			// we deleted, so we expect not to find the schema
			expect(JSON.stringify(await secondSchemaChangePromise)).not.toInclude(
				JSON.stringify(schemaOrHash)
			);

			await expect(inexistentThirdSchemaChangePromise).toResolve();
		},
		TIMEOUT
	);
});
