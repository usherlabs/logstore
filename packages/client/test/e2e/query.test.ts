import { LogStoreManager, LogStoreQueryManager } from '@logsn/contracts';
import {
	getQueryManagerContract,
	getStoreManagerContract,
	prepareStakeForQueryManager,
	prepareStakeForStoreManager,
} from '@logsn/shared';
import {
	MessageID,
	MessageRef,
	StreamMessage,
	toStreamID,
} from '@streamr/protocol';
import {
	fastWallet,
	fetchPrivateKeyWithGas,
	KeyServer,
} from '@streamr/test-utils';
import { toEthereumAddress, wait, waitForCondition } from '@streamr/utils';
import axios from 'axios';
import { providers, Wallet } from 'ethers';
import { range } from 'lodash';
import * as fetch from 'node-fetch';
import { firstValueFrom, from } from 'rxjs';
import { TransformCallback } from 'stream';
import StreamrClient, {
	CONFIG_TEST as STREAMR_CONFIG_TEST,
	Stream,
	StreamPermission,
} from 'streamr-client';

import { CONFIG_TEST as LOGSTORE_CONFIG_TEST } from '../../src/ConfigTest';
import { LogStoreClient } from '../../src/LogStoreClient';
import { LogStoreMessage } from '../../src/LogStoreMessageStream';
import type { StorageMatrix } from '../../src/utils/networkValidation/manageStorageMatrix';
import * as verifyPkg from '../../src/utils/networkValidation/manageStorageMatrix';
import { sleep } from '../test-utils/sleep';
import { createTestStream } from '../test-utils/utils';

const originalFetch = fetch.default;
const fetchSpy = jest.spyOn(fetch, 'default');

const STAKE_AMOUNT = BigInt('1000000000000000000');
const NUM_OF_LAST_MESSAGES = 20;
const NUM_OF_FROM_MESSAGES = 15;
const NUM_OF_RANGE_MESSAGES = 10;
const MESSAGE_STORE_TIMEOUT = 15 * 1000;
const TIMEOUT = 90 * 1000;

const BASE_NODE_URL = `http://localhost:7771`;

describe('query', () => {
	const provider = new providers.JsonRpcProvider(
		STREAMR_CONFIG_TEST.contracts?.streamRegistryChainRPCs?.rpcs[0].url,
		STREAMR_CONFIG_TEST.contracts?.streamRegistryChainRPCs?.chainId
	);

	// Accounts
	let publisherAccount: Wallet;
	let storeOwnerAccount: Wallet;
	let storeConsumerAccount: Wallet;

	// Clients
	let publisherStreamrClient: StreamrClient;
	let consumerStreamrClient: StreamrClient;
	let consumerLogStoreClient: LogStoreClient;

	// Contracts
	let storeManager: LogStoreManager;
	let queryManager: LogStoreQueryManager;

	beforeAll(async () => {
		// Accounts
		const walletsForAccounts = await Promise.all([
			fetchPrivateKeyWithGas(),
			fetchPrivateKeyWithGas(),
			fetchPrivateKeyWithGas(),
		]);

		publisherAccount = new Wallet(walletsForAccounts[0], provider);
		storeOwnerAccount = new Wallet(walletsForAccounts[1], provider);
		storeConsumerAccount = new Wallet(walletsForAccounts[2], provider);

		// Contracts
		[storeManager, queryManager] = await Promise.all([
			getStoreManagerContract(storeOwnerAccount),
			getQueryManagerContract(storeConsumerAccount),
		]);

		// Clients
		publisherStreamrClient = new StreamrClient({
			...STREAMR_CONFIG_TEST,
			auth: {
				privateKey: publisherAccount.privateKey,
			},
		});

		consumerStreamrClient = new StreamrClient({
			...STREAMR_CONFIG_TEST,
			auth: {
				privateKey: storeConsumerAccount.privateKey,
			},
		});
		consumerLogStoreClient = new LogStoreClient(
			consumerStreamrClient,
			LOGSTORE_CONFIG_TEST
		);
	}, TIMEOUT);

	afterAll(async () => {
		await Promise.allSettled([
			publisherStreamrClient?.destroy(),
			consumerStreamrClient?.destroy(),
			consumerLogStoreClient?.destroy(),
			KeyServer.stopIfRunning(),
		]);
	}, TIMEOUT);

	afterEach(async () => {
		jest.clearAllMocks();
	});

	it(
		'has the same data shape if consumed differently',
		async () => {
			const privateStream = await createTestStream(
				publisherStreamrClient,
				module,
				{
					partitions: 1,
				}
			);

			await privateStream.grantPermissions({
				user: await consumerStreamrClient.getAddress(),
				permissions: [StreamPermission.SUBSCRIBE],
			});
			// stake
			await prepareStakeForStoreManager(storeOwnerAccount, STAKE_AMOUNT);
			await storeManager.stake(privateStream.id, STAKE_AMOUNT);

			await sleep(2000);

			// publish to the stream
			await publisherStreamrClient.publish(
				{
					id: privateStream.id,
					partition: 0,
				},
				{
					messageNo: 1,
				}
			);

			await sleep(2000);

			const messages1: unknown[] = [];
			const messages2: unknown[] = [];

			const queryStream1 = await consumerLogStoreClient.query(
				{
					streamId: privateStream.id,
					partition: 0,
				},
				{ last: 1 },
				(content) => {
					console.log('content', content);
					messages1.push(content);
				}
			);

			for await (const msg of queryStream1) {
				console.log('msg', msg);
				messages2.push(msg.content);
			}

			expect(messages1).toStrictEqual(messages2);
			expect(messages1[0]).toStrictEqual({ messageNo: 1 });
		},
		TIMEOUT
	);

	describe('private stream', () => {
		let stream: Stream;

		async function publishMessages(numOfMessages: number) {
			for (const idx of range(numOfMessages)) {
				await publisherStreamrClient.publish(
					{
						id: stream.id,
						partition: 0,
					},
					{
						messageNo: idx,
					}
				);
				await sleep(100);
			}
			await wait(MESSAGE_STORE_TIMEOUT);
		}

		beforeAll(async () => {
			stream = await createTestStream(publisherStreamrClient, module, {
				partitions: 1,
			});

			// TODO: the consumer must have permission to subscribe to the stream or the strem have to be public
			await stream.grantPermissions({
				user: await consumerStreamrClient.getAddress(),
				permissions: [StreamPermission.SUBSCRIBE],
			});
			await stream.grantPermissions({
				public: true,
				permissions: [StreamPermission.SUBSCRIBE],
			});
			// await stream.grantPermissions({
			// 	public: true,
			// 	permissions: [StreamPermission.SUBSCRIBE],
			// });

			await Promise.all([
				prepareStakeForStoreManager(storeOwnerAccount, STAKE_AMOUNT),
				prepareStakeForQueryManager(storeConsumerAccount, STAKE_AMOUNT),
			]);

			await Promise.all([
				storeManager.stake(stream.id, STAKE_AMOUNT),
				queryManager.stake(STAKE_AMOUNT),
			]);
		}, TIMEOUT);

		it(
			'can request a query for the last messages',
			async () => {
				await publishMessages(NUM_OF_LAST_MESSAGES);

				const messages: StreamMessage[] = [];

				await consumerLogStoreClient.query(
					{
						streamId: stream.id,
						partition: 0,
					},
					{ last: NUM_OF_LAST_MESSAGES },
					(msg: any) => {
						messages.push(msg);
					}
				);
				await waitForCondition(
					() => messages.length >= NUM_OF_LAST_MESSAGES,
					TIMEOUT - 1000,
					250,
					undefined,
					() => `messages array length was ${messages.length}`
				);
				expect(messages).toHaveLength(NUM_OF_LAST_MESSAGES);
				expect(messages[0]).toMatchObject({ messageNo: 0 });
			},
			TIMEOUT
		);

		it(
			'can request a query for messages from a timestamp',
			async () => {
				await publishMessages(5);

				const fromTimestamp = Date.now();
				await publishMessages(NUM_OF_FROM_MESSAGES);

				const messages: unknown[] = [];
				await consumerLogStoreClient.query(
					{
						streamId: stream.id,
						partition: 0,
					},
					{ from: { timestamp: fromTimestamp } },
					(msg: any) => {
						messages.push(msg);
					}
				);
				await waitForCondition(
					() => messages.length >= NUM_OF_FROM_MESSAGES,
					TIMEOUT - 1000,
					250,
					undefined,
					() => `messages array length was ${messages.length}`
				);
				expect(messages).toHaveLength(NUM_OF_FROM_MESSAGES);
			},
			TIMEOUT
		);

		it(
			'can request a query for messages for a range of timestamps',
			async () => {
				await publishMessages(5);

				const fromTimestamp = Date.now();
				await publishMessages(NUM_OF_RANGE_MESSAGES);
				const toTimestamp = Date.now();

				await sleep(100);
				await publishMessages(5);

				const messages: unknown[] = [];
				await consumerLogStoreClient.query(
					{
						streamId: stream.id,
						partition: 0,
					},
					{
						from: { timestamp: fromTimestamp },
						to: { timestamp: toTimestamp },
					},
					(msg: any) => {
						messages.push(msg);
					}
				);
				await waitForCondition(
					() => messages.length >= NUM_OF_RANGE_MESSAGES,
					TIMEOUT - 1000,
					250,
					undefined,
					() => `messages array length was ${messages.length}`
				);
				expect(messages).toHaveLength(NUM_OF_RANGE_MESSAGES);
			},
			TIMEOUT
		);

		it(
			'can check the network state for a query',
			async () => {
				const numOfMessagesForThisTest = 2;
				await publishMessages(numOfMessagesForThisTest);

				const storageSpy = jest.spyOn(verifyPkg, 'convertToStorageMatrix');
				const messages: LogStoreMessage[] = [];

				const messagesQuery = await consumerLogStoreClient.query(
					{
						streamId: stream.id,
						partition: 0,
					},
					{ last: numOfMessagesForThisTest },
					undefined,
					{ verifyNetworkResponses: true }
				);

				// using this form to ensure that the iterator is done before the test ends
				for await (const message of messagesQuery) {
					messages.push(message);
				}

				expect(messages).toHaveLength(numOfMessagesForThisTest);
				expect(messages[0].content).toMatchObject({ messageNo: 0 });
				const messagesId = messages.map((c) => c.metadata.id.serialize());

				expect(storageSpy).toBeCalledTimes(1);
				const lastReturn = storageSpy.mock.results[0].value as StorageMatrix;
				// these are messageIds stringified
				expect(lastReturn.size).toBe(numOfMessagesForThisTest);
				lastReturn.forEach((value, key) => {
					expect(value).toBeInstanceOf(Set);
					expect(messagesId).toContain(key);
					// more than one node contains it
					expect(value.size).toBeGreaterThan(0);
				});
				const metadata = await firstValueFrom(messagesQuery.metadataStream);

				expect(metadata.participatingNodesAddress?.length).toBeGreaterThan(1);
			},
			TIMEOUT
		);

		it(
			'can do in parallel 3 queries with verifyNetworkResponses',
			async () => {
				const timesToTest = 3;
				let initialNumberrOfMessagesToFetch = 2;
				// const storageSpy = jest.spyOn(verifyPkg, 'convertToStorageMatrix');
				const maxNumOfMessagesQueried =
					initialNumberrOfMessagesToFetch + timesToTest;
				await publishMessages(maxNumOfMessagesQueried);

				const doTest = async () => {
					// we're taking a different number of messages for each test to try getting edge cases
					const numOfMessagesForThisTest = initialNumberrOfMessagesToFetch++;
					const messages: LogStoreMessage[] = [];

					const messagesQuery = await consumerLogStoreClient.query(
						{
							streamId: stream.id,
							partition: 0,
						},
						{ last: numOfMessagesForThisTest },
						undefined,
						{ verifyNetworkResponses: true }
					);

					// using this form to ensure that the iterator is done before the test ends
					for await (const message of messagesQuery) {
						messages.push(message);
					}

					expect(messages).toHaveLength(numOfMessagesForThisTest);
					expect(messages[0].content).toMatchObject({
						messageNo: expect.any(Number),
					});
				};

				await Promise.all(range(timesToTest).map(() => doTest()));
			},
			TIMEOUT
		);

		it(
			'will error if a message is corrupted',
			async () => {
				const errorListener = jest.fn();

				const numOfMessagesForThisTest = 2;
				await publishMessages(numOfMessagesForThisTest);

				// spy on node-fetch to fake a bad response
				fetchSpy.mockImplementation(async (_url, _init) => {
					const response = await originalFetch(_url, _init);
					// let's alter the first message from the body stream
					const original = response.body;
					let msgCount = 0;
					const transformed = original.pipe(
						new Transform({
							objectMode: true,
							final(callback: (error?: Error | null) => void) {
								callback();
							},
							transform(
								chunk: Uint8Array,
								encoding: BufferEncoding,
								done: TransformCallback
							) {
								try {
									const streamMessage = StreamMessage.deserialize(
										chunk.toString()
									);

									if (msgCount === 0) {
										// modifies message to make it fail
										streamMessage.messageId.publisherId = toEthereumAddress(
											fastWallet().address
										);
									}

									const altered = streamMessage.serialize();
									const alteredBuffer = Buffer.from(altered, encoding);
									this.push(alteredBuffer, encoding);
								} catch (e) {
									this.push(chunk, encoding);
								} finally {
									msgCount++;
									done();
								}
							},
						})
					);

					return new fetch.Response(transformed, {
						headers: response.headers,
						status: response.status,
						statusText: response.statusText,
					});
				});

				const messages: LogStoreMessage[] = [];

				const messagesQuery = await consumerLogStoreClient.query(
					{
						streamId: stream.id,
						partition: 0,
					},
					{ last: numOfMessagesForThisTest }
				);

				// for some reason we can't just surround everything and catch errors
				// there are some data pipelines that make it hard
				// @ts-expect-error this is marked as @internal
				const signal: ErrorSignal = messagesQuery.messageStream.onError;
				signal.listeners = [errorListener];

				// using this form to ensure that the iterator is done before the test ends
				for await (const message of messagesQuery) {
					messages.push(message);
				}

				// 1 message should be corrupted only
				expect(messages).toHaveLength(numOfMessagesForThisTest - 1);
				expect(errorListener.mock.calls[0][0].message).toMatch(
					'Signature validation failed'
				);
				expect(messages[0].content).toMatchObject({ messageNo: 1 });
			},
			TIMEOUT
		);

		describe('can request a query for the last messages via HTTP Interface', () => {
			let queryUrl: string;
			let token: string;

			beforeAll(async () => {
				await publishMessages(NUM_OF_LAST_MESSAGES);

				queryUrl = await consumerLogStoreClient.createQueryUrl(
					BASE_NODE_URL,
					{
						streamId: stream.id,
						partition: 0,
					},
					'last',
					{
						count: NUM_OF_LAST_MESSAGES,
					}
				);
				({ token } = await consumerLogStoreClient.apiAuth());
			}, TIMEOUT);

			it(
				'via json responses',
				async () => {
					const resp = await axios
						.get(queryUrl, {
							headers: {
								Authorization: `Basic ${token}`,
							},
						})
						.then(({ data }) => data as { messages: any[] });

					console.log('HTTP RESPONSE:', resp);

					expect(resp.messages).toHaveLength(NUM_OF_LAST_MESSAGES);
					const _data = resp.messages.map(
						({
							metadata: {
								id: {
									streamId,
									streamPartition,
									timestamp,
									sequenceNumber,
									publisherId,
									msgChainId,
								},
								newGroupKey,
								prevMsgRef,
								messageType,
								contentType,
								encryptionType,
								groupKeyId,
								signature,
							},
							content,
						}) =>
							new StreamMessage({
								messageId: new MessageID(
									toStreamID(streamId),
									streamPartition,
									timestamp,
									sequenceNumber,
									publisherId,
									msgChainId
								),
								content,
								encryptionType,
								groupKeyId,
								signature,
								newGroupKey,
								prevMsgRef: prevMsgRef
									? new MessageRef(
											prevMsgRef?.timestamp,
											prevMsgRef?.sequenceNumber
										)
									: undefined,
								contentType,
								messageType,
							})
					);
					// TODO: expose decrypt method. For this, we need to expose Decrypt class
					//   from @logsn/streamr-client
					// const decryptedData = await consumerClient.decrypt(data[0]);
					//
					// expect(decryptedData.getContent()).toMatchObject({ messageNo: 0 });
				},
				TIMEOUT
			);

			it(
				'via stream',
				async () => {
					const streamJson = await axios.get(queryUrl, {
						headers: {
							Authorization: `Basic ${token}`,
							Accept: 'text/event-stream',
						},
						responseType: 'stream',
					});

					const messages: unknown[] = [];
					streamJson.data.on('data', (chunk: any) => {
						const newObj = JSON.parse(chunk);
						const isMetadata = 'type' in newObj && newObj.type === 'metadata';
						if (!isMetadata) {
							messages.push(newObj);
						}
					});

					await new Promise((resolve) => {
						streamJson.data.on('end', resolve);
					});

					console.log('HTTP STREAM RESPONSE:', messages);
					expect(messages).toHaveLength(NUM_OF_LAST_MESSAGES);
				},
				TIMEOUT
			);
		});
	});

	describe('standalone node', () => {
		test('can configure to query from a standalone node', async () => {
			const streamrClient = new StreamrClient({
				...STREAMR_CONFIG_TEST,
				auth: {
					privateKey: publisherAccount.privateKey,
				},
			});
			const standaloneClient = new LogStoreClient(streamrClient, {
				...LOGSTORE_CONFIG_TEST,
				nodeUrl: 'http://127.0.0.1:7171',
			});
		});
	});

	test('Querying without stake causes good and explicit error', async () => {
		await using cleanup = new AsyncDisposableStack();
		const streamrClient = new StreamrClient({
			...STREAMR_CONFIG_TEST,
			auth: {
				// key that sure doesn't have stake
				privateKey:
					'0x0000000000000000000000000000000000000000000000000000000000002222',
			},
		});
		const logStoreClient = new LogStoreClient(streamrClient, {
			...LOGSTORE_CONFIG_TEST,
		});

		cleanup.defer(async () => {
			await streamrClient.destroy();
			logStoreClient.destroy();
		});

		const randomStreamId = (await streamrClient.getAddress()) + '/doesnt_exist';
		const messagesQuery = await logStoreClient.query(
			{
				streamId: randomStreamId,
				partition: 0,
			},
			{ last: 1 }
		);

		await expect(firstValueFrom(from(messagesQuery))).rejects.toThrow(
			'Storage node fetch failed: Not enough balance staked for query, httpStatus=400'
		);
	});
});
