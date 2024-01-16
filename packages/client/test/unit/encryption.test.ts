import { Wallet } from '@ethersproject/wallet';
import { StreamMessage } from '@streamr/protocol';
import { fetchPrivateKeyWithGas, KeyServer } from '@streamr/test-utils';
import { providers } from 'ethers';
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

const collectQueryResults = async (logStoreClient: LogStoreClient) => {
	const subscription = await logStoreClient.query(
		'doesnt matter, http should be proxied',
		{
			last: 1,
		}
	);

	// group key error is 30 seconds, however for this test 2 seconds is enough
	setTimeout(() => jest.advanceTimersByTime(30000), 2000);
	const error$ = new BehaviorSubject<Error | null>(null);
	subscription.messageStream.onError.listen((e) => error$.next(e));

	const messages$ = from(subscription).pipe(toArray());

	const results$ = combineLatest({
		messages: messages$,
		error: error$,
	});

	return firstValueFrom(results$);
};

describe('Encryption subleties', () => {
	jest.setTimeout(TIMEOUT);
	jest.useFakeTimers({
		advanceTimers: true,
	});

	const provider = new providers.JsonRpcProvider(
		STREAMR_CONFIG_TEST.contracts?.streamRegistryChainRPCs?.rpcs[0].url,
		STREAMR_CONFIG_TEST.contracts?.streamRegistryChainRPCs?.chainId
	);

	let publisherAccount: Wallet;
	let authorizedAccount: Wallet;
	let unauthorizedAccount: Wallet;

	let publisherStreamrClient: StreamrClient;
	let authorizedStreamrClient: StreamrClient;
	let unauthorizedStreamrClient: StreamrClient;

	const fetchSpy = jest.spyOn(nodeFetch, 'default');

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

		publisherAccount = new Wallet(walletsForAccounts[0], provider);
		authorizedAccount = new Wallet(walletsForAccounts[1], provider);
		unauthorizedAccount = new Wallet(walletsForAccounts[2], provider);
	});

	beforeEach(async () => {
		publisherStreamrClient = new StreamrClient({
			...STREAMR_CONFIG_TEST,
			auth: {
				privateKey: publisherAccount.privateKey,
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

		stream = await createTestStream(publisherStreamrClient, module, {
			partitions: 1,
		});

		await publisherStreamrClient.grantPermissions(stream.id, {
			user: await authorizedStreamrClient.getAddress(),
			permissions: [StreamPermission.SUBSCRIBE],
		});

		const message = await publisherStreamrClient.publish(
			stream.id,
			messageContent
		);
		// @ts-expect-error internal
		const streamMessage = message.streamMessage as StreamMessage;

		mockNextFetchResponse(streamMessage);

		await Promise.all(
			[
				publisherStreamrClient,
				authorizedStreamrClient,
				unauthorizedStreamrClient,
			].map((c) => c.connect())
		);
	});

	afterEach(async () => {
		await Promise.allSettled([
			publisherStreamrClient.destroy(),
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
		await publisherStreamrClient.destroy();

		// recreate the publisher, to ensure we have clean state
		publisherStreamrClient = new StreamrClient({
			...STREAMR_CONFIG_TEST,
			auth: {
				privateKey: publisherAccount.privateKey,
			},
		});

		await publisherStreamrClient.connect();
	}

	test('authorized client is able to decrypt messages', async () => {
		const { messages, error } = await collectQueryResults(
			authorizedLogStoreClient
		);

		expect(messages.length).toBe(1);
		expect(error).toBeNull();
		expect(messages[0].content).toEqual(messageContent);
	});

	test('authorized client is not able to decrypt if publisher is offline', async () => {
		// ensure it's authorized
		await expect(
			authorizedStreamrClient.isStreamSubscriber(
				stream.id,
				authorizedAccount.address
			)
		).resolves.toBe(true);

		await publisherStreamrClient.destroy();

		const { messages, error } = await collectQueryResults(
			authorizedLogStoreClient
		);

		expect(messages.length).toBe(0);
		expect(error?.message).toContain('Decrypt error: Could not get GroupKey');
	});

	test('unauthorized client is not able to decrypt messages', async () => {
		// ensure it's not authorized
		await expect(
			unauthorizedStreamrClient.isStreamSubscriber(
				stream.id,
				unauthorizedAccount.address
			)
		).resolves.toBe(false);

		const { messages, error } = await collectQueryResults(
			unauthorizedLogStoreClient
		);

		expect(messages.length).toBe(0);
		expect(error?.message).toContain('Decrypt error: Could not get GroupKey');
	});

	test('later authorization is still able to decrypt messages', async () => {
		// ensure it's not authorized
		await expect(
			unauthorizedStreamrClient.isStreamSubscriber(
				stream.id,
				unauthorizedAccount.address
			)
		).resolves.toBe(false);

		// now authorize
		await publisherStreamrClient.setPermissions({
			streamId: stream.id,
			assignments: [
				{
					user: await unauthorizedStreamrClient.getAddress(),
					permissions: [StreamPermission.SUBSCRIBE],
				},
			],
		});

		const { messages, error } = await collectQueryResults(
			unauthorizedLogStoreClient
		);

		expect(messages.length).toBe(1);
		expect(error).toBeNull();
		expect(messages[0].content).toEqual(messageContent);
	});

	test('later authorization will still decrypt messages if the key is rotated (REKEY) in between', async () => {
		// ensure it's not authorized
		await expect(
			unauthorizedStreamrClient.isStreamSubscriber(
				stream.id,
				unauthorizedAccount.address
			)
		).resolves.toBe(false);

		// rotate key
		await publisherStreamrClient.updateEncryptionKey({
			streamId: stream.id,
			distributionMethod: 'rekey',
		});

		// recreate publisher, to clean the state
		// currently it breaks it. But it is breaking all tests, not only this one, so we don't know yet if it's for a cache
		// await recreatePublisher();

		// now authorize
		await publisherStreamrClient.setPermissions({
			streamId: stream.id,
			assignments: [
				{
					user: await unauthorizedStreamrClient.getAddress(),
					permissions: [StreamPermission.SUBSCRIBE],
				},
			],
		});

		const { messages, error } = await collectQueryResults(
			unauthorizedLogStoreClient
		);

		expect(messages.length).toBe(1);
		expect(error).toBeNull();
		expect(messages[0].content).toEqual(messageContent);
	});

	function mockNextFetchResponse(streamMessage: StreamMessage<unknown>) {
		const metadata = {
			type: 'metadata',
		};

		const payload = [streamMessage.serialize(), JSON.stringify(metadata)].join(
			'\n'
		);

		fetchSpy.mockResolvedValue({
			status: 200,
			text: () => Promise.resolve(payload),
			body: Readable.from(payload),
			ok: true,
		} as any);
	}

	describe('decrypt is based on publisher presence, and not the stream owner', () => {
		let secondPublisher: Wallet;
		let secondPublisherStreamrClient: StreamrClient;

		beforeAll(async () => {
			secondPublisher = new Wallet(await fetchPrivateKeyWithGas(), provider);
		});

		beforeEach(async () => {
			secondPublisherStreamrClient = new StreamrClient({
				...STREAMR_CONFIG_TEST,
				auth: {
					privateKey: secondPublisher.privateKey,
				},
			});

			// authorize second publisher to publish to stream
			await publisherStreamrClient.grantPermissions(stream.id, {
				user: await secondPublisherStreamrClient.getAddress(),
				permissions: [StreamPermission.PUBLISH, StreamPermission.SUBSCRIBE],
			});

			// publish message
			const message = await secondPublisherStreamrClient.publish(
				stream.id,
				messageContent
			);

			// @ts-expect-error internal
			const streamMessage = message.streamMessage as StreamMessage;

			mockNextFetchResponse(streamMessage);

			// ensure everyone is connected
			await Promise.all(
				[
					publisherStreamrClient,
					authorizedStreamrClient,
					unauthorizedStreamrClient,
					secondPublisherStreamrClient,
				].map((c) => c.connect())
			);
		});

		afterEach(async () => {
			await secondPublisherStreamrClient.destroy();
		});

		test('authorized client is able to decrypt messages, with both publishers online', async () => {
			const { messages, error } = await collectQueryResults(
				authorizedLogStoreClient
			);

			expect(messages.length).toBe(1);
			expect(error).toBeNull();
			expect(messages[0].content).toEqual(messageContent);
		});

		test('authorized client is able to decrypt messages, even with stream owner offline', async () => {
			await publisherStreamrClient.destroy();

			const { messages, error } = await collectQueryResults(
				authorizedLogStoreClient
			);

			expect(error).toBeNull();
			expect(messages.length).toBe(1);
			expect(messages[0].content).toEqual(messageContent);
		});

		test('authorized client is able to decrypt messages, with stream owner being offline before the message is even published', async () => {
			await publisherStreamrClient.destroy();

			// publish message
			const message = await secondPublisherStreamrClient.publish(
				stream.id,
				messageContent
			);

			// @ts-expect-error internal
			const streamMessage = message.streamMessage as StreamMessage;
			mockNextFetchResponse(streamMessage);

			const { messages, error } = await collectQueryResults(
				authorizedLogStoreClient
			);

			expect(error).toBeNull();
			expect(messages.length).toBe(1);
			expect(messages[0].content).toEqual(messageContent);
		});

		test('authorized client is not able to decrypt if publisher is offline', async () => {
			// ensure it's authorized
			await expect(
				authorizedStreamrClient.isStreamSubscriber(
					stream.id,
					authorizedAccount.address
				)
			).resolves.toBe(true);

			await secondPublisherStreamrClient.destroy();

			const { messages, error } = await collectQueryResults(
				authorizedLogStoreClient
			);

			expect(messages.length).toBe(0);
			expect(error?.message).toContain('Decrypt error: Could not get GroupKey');
		});

		test('unauthorized client is not able to decrypt messages', async () => {
			// ensure it's not authorized
			await expect(
				unauthorizedStreamrClient.isStreamSubscriber(
					stream.id,
					unauthorizedAccount.address
				)
			).resolves.toBe(false);

			const { messages, error } = await collectQueryResults(
				unauthorizedLogStoreClient
			);

			expect(messages.length).toBe(0);
			expect(error?.message).toContain('Decrypt error: Could not get GroupKey');
		});
	});
});
