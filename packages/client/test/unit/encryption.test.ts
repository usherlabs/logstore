import { Wallet } from '@ethersproject/wallet';
import { StreamMessage } from '@streamr/protocol';
import { fetchPrivateKeyWithGas, KeyServer } from '@streamr/test-utils';
import { providers } from 'ethers';
import type { Response } from 'node-fetch';
import * as nodeFetch from 'node-fetch';
import {
	BehaviorSubject,
	combineLatest,
	firstValueFrom,
	from,
	toArray,
} from 'rxjs';
import { Readable } from 'stream';
import StreamrClient, {
	type Stream,
	StreamPermission,
	CONFIG_TEST as STREAMR_CONFIG_TEST,
} from 'streamr-client';

import { CONFIG_TEST as LOGSTORE_CONFIG_TEST, LogStoreClient } from '../../src';
import { createTestStream } from '../test-utils/utils';

const TIMEOUT = 90 * 1000;

const originalFetch = jest.requireActual('node-fetch').default;

/*
 * Subjects:
 * Publisher A === Stream Owner: The owner of the stream. May also publish.
 * Publisher B: Authorized publisher
 * Publisher C: Authorized publisher
 *
 * Authorized client: Client that has been initially granted permissions to subscribe to the stream
 * Unauthorized client: Client that has not been initially granted permissions to subscribe to the stream
 */

describe('Encryption subleties', () => {
	jest.setTimeout(TIMEOUT);
	jest.useFakeTimers({
		advanceTimers: true,
	});

	const provider = new providers.JsonRpcProvider(
		STREAMR_CONFIG_TEST.contracts?.streamRegistryChainRPCs?.rpcs[0].url,
		STREAMR_CONFIG_TEST.contracts?.streamRegistryChainRPCs?.chainId
	);

	let publisherA_Account: Wallet;
	let authorizedAccount: Wallet;
	let unauthorizedAccount: Wallet;

	let publisherA_StreamrClient: StreamrClient;
	let authorizedStreamrClient: StreamrClient;
	let unauthorizedStreamrClient: StreamrClient;

	const fetchSpy = jest.spyOn(nodeFetch, 'default');
	// keep it original now
	fetchSpy.mockImplementation(originalFetch);

	let authorizedLogStoreClient: LogStoreClient;
	let unauthorizedLogStoreClient: LogStoreClient;

	let stream: Stream;

	const messageContent = {
		hello: 'world',
	};

	beforeAll(async () => {
		const walletsForAccounts = await Promise.all([
			fetchPrivateKeyWithGas(),
			fetchPrivateKeyWithGas(),
			fetchPrivateKeyWithGas(),
		]);

		publisherA_Account = new Wallet(walletsForAccounts[0], provider);
		authorizedAccount = new Wallet(walletsForAccounts[1], provider);
		unauthorizedAccount = new Wallet(walletsForAccounts[2], provider);
	});

	beforeEach(async () => {
		publisherA_StreamrClient = new StreamrClient({
			...STREAMR_CONFIG_TEST,
			auth: {
				privateKey: publisherA_Account.privateKey,
			},
		});

		authorizedStreamrClient = new StreamrClient({
			...STREAMR_CONFIG_TEST,
			auth: {
				privateKey: authorizedAccount.privateKey,
			},
		});

		unauthorizedStreamrClient = new StreamrClient({
			...STREAMR_CONFIG_TEST,
			auth: {
				privateKey: unauthorizedAccount.privateKey,
			},
		});

		authorizedLogStoreClient = new LogStoreClient(
			authorizedStreamrClient,
			LOGSTORE_CONFIG_TEST
		);

		unauthorizedLogStoreClient = new LogStoreClient(
			unauthorizedStreamrClient,
			LOGSTORE_CONFIG_TEST
		);

		stream = await createTestStream(publisherA_StreamrClient, module, {
			partitions: 1,
		});

		await publisherA_StreamrClient.grantPermissions(stream.id, {
			user: await authorizedStreamrClient.getAddress(),
			permissions: [StreamPermission.SUBSCRIBE],
		});

		await Promise.all(
			[
				publisherA_StreamrClient,
				authorizedStreamrClient,
				unauthorizedStreamrClient,
			].map((c) => c.connect())
		);
	});

	afterEach(async () => {
		await Promise.allSettled([
			publisherA_StreamrClient.destroy(),
			authorizedStreamrClient.destroy(),
			unauthorizedStreamrClient.destroy(),
		]);

		jest.clearAllTimers();
		jest.clearAllMocks();
	});

	afterAll(async () => {
		await KeyServer.stopIfRunning();
	});

	async function recreatePublisher() {
		// destroy the publisher
		await publisherA_StreamrClient.destroy();

		// recreate the publisher, to ensure we have clean state
		publisherA_StreamrClient = new StreamrClient({
			...STREAMR_CONFIG_TEST,
			auth: {
				privateKey: publisherA_Account.privateKey,
			},
		});

		await publisherA_StreamrClient.connect();
	}

	async function tryDecryptMessage(
		logStoreClient: LogStoreClient,
		streamMessage: StreamMessage
	) {
		fakeNextQueryResponse(streamMessage);

		// we use this method of mocking and fetching, so we know it will go through
		// the normal decryption flow of our client
		const subscription = await logStoreClient.query('FAKE_QUERY', {
			last: 1,
		});

		// group key error is 30 seconds, however for this test 5 seconds is enough
		setTimeout(() => jest.advanceTimersByTime(30000), 5000);
		const error$ = new BehaviorSubject<Error | null>(null);
		subscription.messageStream.onError.listen((e) => error$.next(e));

		const messages$ = from(subscription).pipe(toArray());

		const results$ = combineLatest({
			messages: messages$,
			error: error$,
		});

		return firstValueFrom(results$);
	}

	async function getStreamMessage(streamrClient: StreamrClient) {
		// publish message
		const message = await streamrClient.publish(stream.id, messageContent);

		// @ts-expect-error internal
		const streamMessage = message.streamMessage as StreamMessage;

		return streamMessage;
	}

	test('authorized client is able to decrypt messages', async () => {
		const streamMessage = await getStreamMessage(publisherA_StreamrClient);

		// this oddly makes it fail if commented out. Should it?
		// await recreatePublisher()
		// await sleep(5000);

		const { messages, error } = await tryDecryptMessage(
			authorizedLogStoreClient,
			streamMessage
		);

		expect(messages.length).toBe(1);
		expect(error).toBeNull();
		expect(messages[0].content).toEqual(messageContent);
	});

	test('authorized client is not able to decrypt if publisher is offline', async () => {
		const streamMessage = await getStreamMessage(publisherA_StreamrClient);
		// ensure it's authorized
		await expect(
			authorizedStreamrClient.isStreamSubscriber(
				stream.id,
				authorizedAccount.address
			)
		).resolves.toBe(true);

		await publisherA_StreamrClient.destroy();

		const { messages, error } = await tryDecryptMessage(
			authorizedLogStoreClient,
			streamMessage
		);

		expect(messages.length).toBe(0);
		expect(error?.message).toContain('Decrypt error: Could not get GroupKey');
	});

	test('unauthorized client is not able to decrypt messages', async () => {
		const streamMessage = await getStreamMessage(publisherA_StreamrClient);

		// ensure it's not authorized
		await expect(
			unauthorizedStreamrClient.isStreamSubscriber(
				stream.id,
				unauthorizedAccount.address
			)
		).resolves.toBe(false);

		const { messages, error } = await tryDecryptMessage(
			unauthorizedLogStoreClient,
			streamMessage
		);

		expect(messages.length).toBe(0);
		expect(error?.message).toContain('Decrypt error: Could not get GroupKey');
	});

	test('later authorization is still able to decrypt messages', async () => {
		const streamMessage = await getStreamMessage(publisherA_StreamrClient);

		// ensure it's not authorized
		await expect(
			unauthorizedStreamrClient.isStreamSubscriber(
				stream.id,
				unauthorizedAccount.address
			)
		).resolves.toBe(false);

		// now authorize
		await publisherA_StreamrClient.setPermissions({
			streamId: stream.id,
			assignments: [
				{
					user: await unauthorizedStreamrClient.getAddress(),
					permissions: [StreamPermission.SUBSCRIBE],
				},
			],
		});

		const { messages, error } = await tryDecryptMessage(
			unauthorizedLogStoreClient,
			streamMessage
		);

		expect(messages.length).toBe(1);
		expect(error).toBeNull();
		expect(messages[0].content).toEqual(messageContent);
	});

	test('later authorization will still decrypt messages if the key is rotated (REKEY) in between', async () => {
		const streamMessage = await getStreamMessage(publisherA_StreamrClient);

		// ensure it's not authorized
		await expect(
			unauthorizedStreamrClient.isStreamSubscriber(
				stream.id,
				unauthorizedAccount.address
			)
		).resolves.toBe(false);

		// rotate key
		await publisherA_StreamrClient.updateEncryptionKey({
			streamId: stream.id,
			distributionMethod: 'rekey',
		});

		// recreate publisher, to clean the state
		// currently it breaks it. But it is breaking all tests, not only this one, so we don't know yet if it's for a cache
		// await recreatePublisher();

		// now authorize
		await publisherA_StreamrClient.setPermissions({
			streamId: stream.id,
			assignments: [
				{
					user: await unauthorizedStreamrClient.getAddress(),
					permissions: [StreamPermission.SUBSCRIBE],
				},
			],
		});

		const { messages, error } = await tryDecryptMessage(
			unauthorizedLogStoreClient,
			streamMessage
		);

		expect(error).toBeNull();
		expect(messages.length).toBe(1);
		expect(messages[0].content).toEqual(messageContent);
	});

	function fakeNextQueryResponse(streamMessage: StreamMessage) {
		const metadata = {
			type: 'metadata',
		};

		const payload = [streamMessage.serialize(), JSON.stringify(metadata)].join(
			'\n'
		);

		fetchSpy.mockImplementationOnce(async (...args) => {
			// FAKE_QUERY is included as the streamId to be fetched
			if (args[0].toString().includes('FAKE_QUERY')) {
				return {
					status: 200,
					text: () => Promise.resolve(payload),
					body: Readable.from(payload),
					ok: true,
				} as unknown as Response;
			} else {
				return originalFetch(...args);
			}
		});
	}

	describe('decrypt is based on publisher presence, and not the stream owner', () => {
		let publisherB_Account: Wallet;
		let publisherB_StreamrClient: StreamrClient;

		beforeAll(async () => {
			publisherB_Account = new Wallet(await fetchPrivateKeyWithGas(), provider);
		});

		beforeEach(async () => {
			publisherB_StreamrClient = new StreamrClient({
				...STREAMR_CONFIG_TEST,
				auth: {
					privateKey: publisherB_Account.privateKey,
				},
			});

			// authorize publisher B to publish to stream
			await publisherA_StreamrClient.grantPermissions(stream.id, {
				user: await publisherB_StreamrClient.getAddress(),
				permissions: [StreamPermission.PUBLISH, StreamPermission.SUBSCRIBE],
			});

			// ensure everyone is connected
			await Promise.all(
				[
					publisherA_StreamrClient,
					authorizedStreamrClient,
					unauthorizedStreamrClient,
					publisherB_StreamrClient,
				].map((c) => c.connect())
			);
		});

		afterEach(async () => {
			await publisherB_StreamrClient.destroy();
		});

		test('authorized client is able to decrypt messages, with both publishers online', async () => {
			const streamMessageCreatedByPublisherB = await getStreamMessage(
				publisherB_StreamrClient
			);

			const { messages, error } = await tryDecryptMessage(
				authorizedLogStoreClient,
				streamMessageCreatedByPublisherB
			);

			expect(messages.length).toBe(1);
			expect(error).toBeNull();
			expect(messages[0].content).toEqual(messageContent);
		});

		test('authorized client is able to decrypt messages, even with stream owner offline', async () => {
			const streamMessageCreatedByPublisherB = await getStreamMessage(
				publisherB_StreamrClient
			);
			await publisherA_StreamrClient.destroy();

			const { messages, error } = await tryDecryptMessage(
				authorizedLogStoreClient,
				streamMessageCreatedByPublisherB
			);

			expect(error).toBeNull();
			expect(messages.length).toBe(1);
			expect(messages[0].content).toEqual(messageContent);
		});

		test('authorized client is able to decrypt messages, with stream owner being offline before the message is even published', async () => {
			const publisherC = new Wallet(await fetchPrivateKeyWithGas(), provider);

			// grant acccess to this publisher C
			await publisherA_StreamrClient.grantPermissions(stream.id, {
				user: await publisherC.getAddress(),
				permissions: [StreamPermission.PUBLISH, StreamPermission.SUBSCRIBE],
			});

			await publisherA_StreamrClient.destroy();

			const publisherCStreamrClient = new StreamrClient({
				...STREAMR_CONFIG_TEST,
				auth: {
					privateKey: publisherC.privateKey,
				},
			});

			const streamMessage = await getStreamMessage(publisherCStreamrClient);

			const { messages, error } = await tryDecryptMessage(
				authorizedLogStoreClient,
				streamMessage
			);

			expect(error).toBeNull();
			expect(messages.length).toBe(1);
			expect(messages[0].content).toEqual(messageContent);
		});

		test('authorized client is not able to decrypt if publisher is offline', async () => {
			const streamMessage = await getStreamMessage(publisherB_StreamrClient);

			// ensure it's authorized
			await expect(
				authorizedStreamrClient.isStreamSubscriber(
					stream.id,
					authorizedAccount.address
				)
			).resolves.toBe(true);

			await publisherB_StreamrClient.destroy();

			const { messages, error } = await tryDecryptMessage(
				authorizedLogStoreClient,
				streamMessage
			);

			expect(messages.length).toBe(0);
			expect(error?.message).toContain('Decrypt error: Could not get GroupKey');
		});

		test('unauthorized client is not able to decrypt messages', async () => {
			const streamMessage = await getStreamMessage(publisherB_StreamrClient);

			// ensure it's not authorized
			await expect(
				unauthorizedStreamrClient.isStreamSubscriber(
					stream.id,
					unauthorizedAccount.address
				)
			).resolves.toBe(false);

			const { messages, error } = await tryDecryptMessage(
				unauthorizedLogStoreClient,
				streamMessage
			);

			expect(messages.length).toBe(0);
			expect(error?.message).toContain('Decrypt error: Could not get GroupKey');
		});

		test('decrypt of a message is based on its direct publisher only', async () => {
			const messageCreatedByOwner = await getStreamMessage(
				publisherA_StreamrClient
			);

			const publisherC = new Wallet(await fetchPrivateKeyWithGas(), provider);

			// grant acccess to this publisher C
			await publisherA_StreamrClient.grantPermissions(stream.id, {
				user: await publisherC.getAddress(),
				permissions: [StreamPermission.PUBLISH, StreamPermission.SUBSCRIBE],
			});

			await publisherA_StreamrClient.destroy();

			const publisherC_StreamrClient = new StreamrClient({
				...STREAMR_CONFIG_TEST,
				auth: {
					privateKey: publisherC.privateKey,
				},
			});

			const messageCreatedByPublisherC = await getStreamMessage(
				publisherC_StreamrClient
			);

			// ensure it's authorized
			await expect(
				authorizedStreamrClient.isStreamSubscriber(
					stream.id,
					authorizedAccount.address
				)
			).resolves.toBe(true);

			{
				// message by publisher C is able to decrypted -- reason: publisher C is online
				const { messages, error } = await tryDecryptMessage(
					authorizedLogStoreClient,
					messageCreatedByPublisherC
				);

				expect(error).toBeNull();
				expect(messages.length).toBe(1);
				expect(messages[0].content).toEqual(messageContent);
			}

			{
				// message by owner is not able to decrypted -- reason: owner is offline
				const { messages, error } = await tryDecryptMessage(
					authorizedLogStoreClient,
					messageCreatedByOwner
				);

				expect(messages.length).toBe(0);
				expect(error?.message).toContain(
					'Decrypt error: Could not get GroupKey'
				);
			}
		});
	});
});
