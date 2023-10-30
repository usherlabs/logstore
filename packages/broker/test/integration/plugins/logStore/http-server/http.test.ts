import {
	CONFIG_TEST,
	LogStoreClient,
	NodeMetadata,
	Stream,
	StreamPermission,
	verify,
} from '@logsn/client';
import {
	LogStoreManager,
	LogStoreNodeManager,
	LogStoreQueryManager,
	LSAN,
} from '@logsn/contracts';
import {
	getNodeManagerContract,
	getQueryManagerContract,
	getStoreManagerContract,
	getTokenManagerContract,
	prepareStakeForNodeManager,
	prepareStakeForQueryManager,
	prepareStakeForStoreManager,
} from '@logsn/shared';
import { Tracker } from '@streamr/network-tracker';
import {
	createSignaturePayload,
	MessageID,
	StreamMessage,
} from '@streamr/protocol';
import {
	fastWallet,
	fetchPrivateKeyWithGas,
	KeyServer,
} from '@streamr/test-utils';
import { toEthereumAddress, wait } from '@streamr/utils';
import axios from 'axios';
import { providers, Wallet } from 'ethers';
import { range } from 'lodash';
import { Readable } from 'stream';

import { Broker } from '../../../../../src/broker';
import { toObject } from '../../../../../src/plugins/logStore/http/DataQueryFormat';
import {
	createLogStoreClient,
	createTestStream,
	sleep,
	startLogStoreBroker,
	startTestTracker,
} from '../../../../utils';

jest.setTimeout(60000);

const STAKE_AMOUNT = BigInt(1e22);
const MESSAGE_STORE_TIMEOUT = 9 * 1000;
const BASE_NUMBER_OF_MESSAGES = 16;

const BROKER_URL = 'http://127.0.0.1:7171';

// There are two options to run the test managed by a value of the TRACKER_PORT constant:
// 1. TRACKER_PORT = undefined - run the test against the brokers running in dev-env and brokers run by the test script.
// 2. TRACKER_PORT = 17771 - run the test against only brokers run by the test script.
//    In this case dev-env doesn't run any brokers and there is no brokers joined the network (NodeManager.totalNodes == 0)
const TRACKER_PORT = 17771;

// setting a more easy to test limit
const mockTestLimit = BASE_NUMBER_OF_MESSAGES + 10;
jest.mock('../../../../../src/plugins/logStore/http/constants', () => {
	const originalModule = jest.requireActual(
		'../../../../../src/plugins/logStore/http/constants'
	);
	return {
		...originalModule,
		get EVENTS_PER_RESPONSE_LIMIT_ON_NON_STREAM() {
			return mockTestLimit;
		},
	};
});

describe('http works', () => {
	const provider = new providers.JsonRpcProvider(
		CONFIG_TEST.contracts?.streamRegistryChainRPCs?.rpcs[0].url,
		CONFIG_TEST.contracts?.streamRegistryChainRPCs?.chainId
	);

	// Accounts
	let adminAccount: Wallet;
	let logStoreBrokerAccount: Wallet;
	let publisherAccount: Wallet;
	let storeOwnerAccount: Wallet;
	let storeConsumerAccount: Wallet;

	// Broker
	let logStoreBroker: Broker;

	// Clients
	let publisherClient: LogStoreClient;
	let consumerClient: LogStoreClient;

	// Contracts
	let nodeManager: LogStoreNodeManager;
	let storeManager: LogStoreManager;
	let queryManager: LogStoreQueryManager;
	let nodeAdminManager: LogStoreNodeManager;
	let tokenAdminManager: LSAN;

	let tracker: Tracker;
	let testStream: Stream;

	beforeAll(async () => {
		logStoreBrokerAccount = new Wallet(
			await fetchPrivateKeyWithGas(),
			provider
		);
		// Accounts
		const [privateKey, privateKey1, privateKey2] = await Promise.all([
			fetchPrivateKeyWithGas(),
			fetchPrivateKeyWithGas(),
			fetchPrivateKeyWithGas(),
		]);
		// Accounts
		adminAccount = new Wallet(
			process.env.CONTRACT_OWNER_PRIVATE_KEY!,
			provider
		);
		publisherAccount = new Wallet(privateKey, provider);
		storeOwnerAccount = new Wallet(privateKey1, provider);
		storeConsumerAccount = new Wallet(privateKey2, provider);

		// Contracts

		nodeAdminManager = await getNodeManagerContract(adminAccount);
		tokenAdminManager = await getTokenManagerContract(adminAccount);
		nodeManager = await getNodeManagerContract(logStoreBrokerAccount);
		storeManager = await getStoreManagerContract(storeOwnerAccount);
		queryManager = await getQueryManagerContract(storeConsumerAccount);
	});

	afterAll(async () => {
		// TODO: Setup global tear-down
		await KeyServer.stopIfRunning();
	});

	beforeEach(async () => {
		if (TRACKER_PORT) {
			tracker = await startTestTracker(TRACKER_PORT);
		}
		const nodeMetadata: NodeMetadata = {
			http: BROKER_URL,
		};

		await nodeAdminManager
			.whitelistApproveNode(logStoreBrokerAccount.address)
			.then((tx) => tx.wait());
		await tokenAdminManager
			.addWhitelist(logStoreBrokerAccount.address, nodeManager.address)
			.then((tx) => tx.wait());

		await prepareStakeForNodeManager(logStoreBrokerAccount, STAKE_AMOUNT);
		(
			await nodeManager.join(STAKE_AMOUNT, JSON.stringify(nodeMetadata), {
				nonce: await logStoreBrokerAccount.getTransactionCount(),
			})
		).wait();

		// Wait for the granted permissions to the system stream
		await sleep(5000);

		[logStoreBroker, publisherClient, consumerClient] = await Promise.all([
			startLogStoreBroker({
				privateKey: logStoreBrokerAccount.privateKey,
				trackerPort: TRACKER_PORT,
			}),
			createLogStoreClient(tracker, publisherAccount.privateKey),
			createLogStoreClient(tracker, storeConsumerAccount.privateKey),
		]);

		// Grant permission for querying

		// Creates a stream
		testStream = await createTestStream(publisherClient, module);
		// Stakes for storage
		await prepareStakeForStoreManager(storeOwnerAccount, STAKE_AMOUNT);
		await storeManager
			.stake(testStream.id, STAKE_AMOUNT)
			.then((tx) => tx.wait());

		Promise.all([
			// Stakes for querying
			(async () => {
				await prepareStakeForQueryManager(storeConsumerAccount, STAKE_AMOUNT);
				await queryManager.stake(STAKE_AMOUNT).then((tx) => tx.wait());
			})(),
			// makes it readable by the consumer
			testStream.grantPermissions({
				user: await consumerClient.getAddress(),
				permissions: [StreamPermission.SUBSCRIBE],
			}),
		]);
	});

	afterEach(async () => {
		await publisherClient.destroy();
		await consumerClient.destroy();
		await Promise.allSettled([
			logStoreBroker?.stop(),
			nodeManager.leave().then((tx) => tx.wait()),
			tracker?.stop(),
		]);
	});

	// HELPERS

	async function publishMessages(numOfMessages: number) {
		for (const idx of range(numOfMessages)) {
			await publisherClient.publish(
				{
					id: testStream.id,
					partition: 0,
				},
				{
					messageNo: idx,
				}
			);
			await sleep(200);
		}
		await wait(MESSAGE_STORE_TIMEOUT);
	}

	const createQueryUrl = async ({
		type,
		options,
	}: {
		type: string;
		options: any;
	}) => {
		return consumerClient.createQueryUrl(
			BROKER_URL,
			{
				streamId: testStream.id,
				partition: 0,
			},
			type,
			options
		);
	};

	/**
	 * Creates query URLs for reuse
	 */
	const createQueryUrls = async ({
		lastCount,
		fromTimestamp,
		toTimestamp,
		format,
	}: {
		/// Number of messages to fetch just on the `last` query
		lastCount: number;
		fromTimestamp: number;
		toTimestamp: number;
		format?: 'raw' | 'object';
	}) => {
		const queryUrlLast = await createQueryUrl({
			type: 'last',
			options: { format, count: lastCount },
		});
		const queryUrlFrom = await createQueryUrl({
			type: 'from',
			options: { format, fromTimestamp },
		});
		const queryUrlRange = await createQueryUrl({
			type: 'range',
			options: {
				format,
				fromTimestamp,
				toTimestamp,
			},
		});

		return { queryUrlLast, queryUrlFrom, queryUrlRange };
	};
	//

	describe('JSON responses', () => {
		const performQuery = async ({
			queryUrl,
			token,
		}: {
			queryUrl: string;
			token: string;
		}) => {
			return axios
				.get(queryUrl, {
					headers: {
						Authorization: `Basic ${token}`,
					},
				})
				.then(({ data }) => data);
		};

		test('Query is normally fetched under messages limit', async () => {
			const timestampBefore = Date.now();
			await publishMessages(BASE_NUMBER_OF_MESSAGES);
			const timestampAfter = Date.now();

			const { queryUrlLast, queryUrlFrom, queryUrlRange } =
				await createQueryUrls({
					lastCount: BASE_NUMBER_OF_MESSAGES,
					// make sure we get everything
					fromTimestamp: timestampBefore - 10,
					toTimestamp: timestampAfter + 10,
				});
			const { token } = await consumerClient.apiAuth();

			const queryResponses = await Promise.all(
				[queryUrlLast, queryUrlFrom, queryUrlRange].map((queryUrl) =>
					performQuery({ queryUrl, token })
				)
			);

			queryResponses.forEach((resp) => {
				console.log('HTTP RESPONSE:', resp);
				expect(resp.messages).toHaveLength(BASE_NUMBER_OF_MESSAGES);
				expect(resp.metadata.hasNext).toBe(false);
				expect(resp.metadata.nextTimestamp).toBeUndefined();
				expect(resp).toMatchObject({
					messages: expect.any(Array),
					metadata: {
						hasNext: expect.any(Boolean),
					},
				});
			});
			expectAllItemsToBeEqual(queryResponses);
		});

		test('Query is limited if not using HTTP streams', async () => {
			const N_MESSAGES_TO_SEND = mockTestLimit + 10;

			const timestampBefore = Date.now();
			await publishMessages(N_MESSAGES_TO_SEND);
			const timestampAfter = Date.now();

			const { queryUrlRange, queryUrlLast, queryUrlFrom } =
				await createQueryUrls({
					lastCount: N_MESSAGES_TO_SEND,
					// make sure we get everything
					fromTimestamp: timestampBefore - 10,
					toTimestamp: timestampAfter + 10,
				});

			const { token } = await consumerClient.apiAuth();

			const queryResponses = await Promise.all(
				[queryUrlLast, queryUrlFrom, queryUrlRange].map((queryUrl) =>
					performQuery({ queryUrl: queryUrl, token: token })
				)
			);

			await sleep(10_000);

			queryResponses.forEach((resp) => {
				console.log('HTTP RESPONSE:', resp);
				expect(resp.messages).toHaveLength(mockTestLimit);
				expect(resp.metadata.hasNext).toBe(true);
				expect(resp.metadata.nextTimestamp).toBeGreaterThan(timestampBefore);
				expect(resp).toMatchObject({
					messages: expect.any(Array),
					metadata: {
						hasNext: expect.any(Boolean),
						nextTimestamp: expect.any(Number),
						totalMessages: expect.any(Number),
					},
				});
			});

			// This won't be true, as the responses are limited, last query will have messages more recent
			// than the first query
			// VVVVVVVVVVVVVVVVVVVV
			// expectAllItemsToBeEqual(queryResponses);
		});

		test('Format is correct and response is verifiable', async () => {
			await publishMessages(BASE_NUMBER_OF_MESSAGES);

			const queryUrlLast = await createQueryUrl({
				type: 'last',
				options: { format: 'object', count: BASE_NUMBER_OF_MESSAGES },
			});

			const { token } = await consumerClient.apiAuth();

			const queryResponse = await performQuery({
				queryUrl: queryUrlLast,
				token,
			});

			expect(queryResponse.messages).toHaveLength(BASE_NUMBER_OF_MESSAGES);
			const modelMessage: ReturnType<typeof toObject> =
				queryResponse.messages[0];
			expect(modelMessage).toEqual({
				metadata: {
					id: expect.any(Object),
					prevMsgRef: expect.any(Object), // can be null
					messageType: expect.any(Number),
					contentType: expect.any(Number),
					encryptionType: expect.any(Number),
					groupKeyId: expect.any(String),
					newGroupKey: expect.any(Object), // can be null
					signature: expect.any(String),
				},
				content: expect.any(String),
			});

			const metadata = modelMessage.metadata;

			const streamMessage = new StreamMessage({
				messageId: new MessageID(
					metadata.id.streamId,
					metadata.id.streamPartition,
					metadata.id.timestamp,
					metadata.id.sequenceNumber,
					metadata.id.publisherId,
					metadata.id.msgChainId
				),
				content: modelMessage.content,
				contentType: metadata.contentType,
				encryptionType: metadata.encryptionType,
				groupKeyId: metadata.groupKeyId,
				messageType: metadata.messageType,
				signature: metadata.signature,
				newGroupKey: metadata.newGroupKey,
				prevMsgRef: metadata.prevMsgRef,
			});

			const payload = createSignaturePayload({
				messageId: streamMessage.messageId,
				serializedContent: streamMessage.getSerializedContent(),
				prevMsgRef: streamMessage.getPreviousMessageRef() ?? undefined,
				newGroupKey: streamMessage.getNewGroupKey() ?? undefined,
			});

			const verification = verify(
				toEthereumAddress(publisherAccount.address),
				payload,
				metadata.signature
			);
			const badVerification = verify(
				toEthereumAddress(fastWallet().address),
				payload,
				metadata.signature
			);

			expect(verification).toBe(true);
			expect(badVerification).toBe(false);
		});
	});

	describe('Stream responses', () => {
		const performStreamedQuery = async ({
			queryUrl,
			token,
		}: {
			queryUrl: string;
			token: string;
		}) => {
			const httpStream = axios
				.get(queryUrl, {
					headers: {
						Authorization: `Basic ${token}`,
						Accept: 'text/event-stream',
					},
					responseType: 'stream',
				})
				.then(({ data }) => data as Readable);

			const response = await streamToMessages(httpStream);
			return response;
		};

		function streamToMessages(httpStream: Promise<Readable>) {
			return new Promise<any[]>((resolve, reject) => {
				const messages: any[] = [];
				httpStream
					.then((stream) => {
						stream.on('data', (chunk) => {
							// we know this chunk is a string as per our code, and not binary or any other type of data
							const eventFromChunk = JSON.parse(chunk.toString());
							messages.push(eventFromChunk);
						});
						stream.on('end', () => {
							resolve(messages);
						});
						stream.on('error', (err) => {
							reject(err);
						});
					})
					.catch((err) => {
						reject(err);
					});
			});
		}

		test('gets raw responses correctly', async () => {
			const timestampBefore = Date.now();
			await publishMessages(BASE_NUMBER_OF_MESSAGES);
			const timestampAfter = Date.now();

			const { queryUrlLast, queryUrlFrom, queryUrlRange } =
				await createQueryUrls({
					lastCount: BASE_NUMBER_OF_MESSAGES,
					fromTimestamp: timestampBefore - 10,
					toTimestamp: timestampAfter + 10,
					format: 'raw',
				});

			const { token } = await consumerClient.apiAuth();

			const queryResponses = await Promise.all(
				[queryUrlLast, queryUrlFrom, queryUrlRange].map((queryUrl) =>
					performStreamedQuery({ queryUrl, token })
				)
			);

			queryResponses.forEach((response) => {
				expect(response).toHaveLength(BASE_NUMBER_OF_MESSAGES);
			});

			expectAllItemsToBeEqual(queryResponses);
		});

		test('Querying below the limit returns normally', async () => {
			const timestampBefore = Date.now();
			await publishMessages(BASE_NUMBER_OF_MESSAGES);
			const timestampAfter = Date.now();

			const { queryUrlFrom, queryUrlLast, queryUrlRange } =
				await createQueryUrls({
					lastCount: BASE_NUMBER_OF_MESSAGES,
					fromTimestamp: timestampBefore - 10,
					toTimestamp: timestampAfter + 10,
				});

			const { token } = await consumerClient.apiAuth();

			const queryResponses = await Promise.all(
				[queryUrlLast, queryUrlFrom, queryUrlRange].map((queryUrl) =>
					performStreamedQuery({ queryUrl, token })
				)
			);

			// const response = await streamToMessages(httpStream);
			queryResponses.forEach((response) => {
				expect(response).toHaveLength(BASE_NUMBER_OF_MESSAGES);
			});
			expectAllItemsToBeEqual(queryResponses);
		});

		test('Querying above the limit is also OK on streams', async () => {
			const MESSAGES_ABOVE_QUERY_LIMIT = mockTestLimit + 10;

			const timestampBefore = Date.now();
			await publishMessages(MESSAGES_ABOVE_QUERY_LIMIT);
			const timestampAfter = Date.now();

			const { queryUrlRange, queryUrlLast, queryUrlFrom } =
				await createQueryUrls({
					lastCount: MESSAGES_ABOVE_QUERY_LIMIT,
					fromTimestamp: timestampBefore - 10,
					toTimestamp: timestampAfter + 10,
				});

			const { token } = await consumerClient.apiAuth();

			const queryResponses = await Promise.all(
				[queryUrlLast, queryUrlFrom, queryUrlRange].map((queryUrl) =>
					performStreamedQuery({ queryUrl: queryUrl, token: token })
				)
			);

			queryResponses.forEach((resp) => {
				expect(resp).toHaveLength(MESSAGES_ABOVE_QUERY_LIMIT);
			});
			expectAllItemsToBeEqual(queryResponses);
		});
	});
});

const expectAllItemsToBeEqual = (items: any[]) => {
	const [firstItem, ...restItems] = items;
	const reference = JSON.stringify(firstItem);

	restItems.forEach((item) => {
		expect(JSON.stringify(item)).toBe(reference);
	});
};
