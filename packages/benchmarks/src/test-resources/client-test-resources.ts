import { CONFIG_TEST, LogStoreClient } from '@logsn/client';
import { LogStoreManager, LogStoreQueryManager } from '@logsn/contracts';
import {
	getQueryManagerContract,
	getStoreManagerContract,
	prepareStakeForQueryManager,
	prepareStakeForStoreManager,
} from '@logsn/shared';
import type { Message } from '@streamr-client';
import { Stream, StreamPermission } from '@streamr-client';
import { fetchPrivateKeyWithGas } from '@streamr/test-utils';
import { providers, Wallet } from 'ethers';
import { range } from 'lodash';

import { createTestStream } from '../utils/test-stream';

/*
 * This file contains resources to be used when vitest fixtures gets available
 * https://github.com/vitest-dev/vitest/issues/3626
 * https://github.com/vitest-dev/vitest/pull/3554
 *
 * Good documentation on how test-fixtures works available here:
 * https://playwright.dev/docs/test-fixtures
 * Composability is the main advantage over hooks (beforeAll, beforeEach, etc.)
 */

const STAKE_AMOUNT = BigInt('1000000000000000000');
const MESSAGE_STORE_TIMEOUT = 9 * 1000;

type Resource<T, Deps = Record<string, unknown>> = (
	fixtures: Deps,
	use: (res: T) => Promise<void> | void
) => Promise<void>;

type PublishMessage = (numberOfMessages: number) => Promise<void>;
type StreamBag = { instance: Stream; publishManyMessages: PublishMessage };

type Fixtures = {
	provider: providers.JsonRpcProvider;
	publisherAccount: Wallet;
	storeOwnerAccount: Wallet;
	storeConsumerAccount: Wallet;
	storeManager: LogStoreManager;
	queryManager: LogStoreQueryManager;
	publisherClient: LogStoreClient;
	consumerClient: LogStoreClient;
	stream: StreamBag;
};

const useProvider: Resource<providers.JsonRpcProvider> = async (
	// need to have empty object here not to use every variable
	// eslint-disable-next-line no-empty-pattern
	{},
	use
) => {
	const provider = new providers.JsonRpcProvider(
		CONFIG_TEST.contracts?.streamRegistryChainRPCs?.rpcs[0].url,
		CONFIG_TEST.contracts?.streamRegistryChainRPCs?.chainId
	);
	await use(provider);
};

const usePublisherAccount: Resource<
	Wallet,
	Pick<Fixtures, 'provider'>
> = async ({ provider }, use) => {
	const account = new Wallet(await fetchPrivateKeyWithGas(), provider);
	await use(account);
};

const useStoreOwnerAccount: Resource<
	Wallet,
	Pick<Fixtures, 'provider'>
> = async ({ provider }, use) => {
	const account = new Wallet(await fetchPrivateKeyWithGas(), provider);
	await use(account);
};

const useStoreConsumerAccount: Resource<
	Wallet,
	Pick<Fixtures, 'provider'>
> = async ({ provider }, use) => {
	const account = new Wallet(await fetchPrivateKeyWithGas(), provider);
	await use(account);
};

const useStoreManager: Resource<
	LogStoreManager,
	Pick<Fixtures, 'storeOwnerAccount' | 'stream'>
> = async ({ storeOwnerAccount, stream }, use) => {
	const storeManager = await getStoreManagerContract(storeOwnerAccount);

	await prepareStakeForStoreManager(storeOwnerAccount, STAKE_AMOUNT);
	await storeManager.stake(stream.instance.id, STAKE_AMOUNT);

	await use(storeManager);
};

const useQueryManager: Resource<
	LogStoreQueryManager,
	Pick<Fixtures, 'storeConsumerAccount'>
> = async ({ storeConsumerAccount }, use) => {
	const queryManager = await getQueryManagerContract(storeConsumerAccount);
	await prepareStakeForQueryManager(storeConsumerAccount, STAKE_AMOUNT);
	await queryManager.stake(STAKE_AMOUNT);

	await use(queryManager);
};

const useConsumerClient: Resource<
	LogStoreClient,
	Pick<Fixtures, 'storeConsumerAccount'>
> = async ({ storeConsumerAccount }, use) => {
	const client = new LogStoreClient({
		...CONFIG_TEST,
		auth: {
			privateKey: storeConsumerAccount.privateKey,
		},
	});
	await use(client);

	await client.destroy();
};

const usePublisherClient: Resource<
	LogStoreClient,
	Pick<Fixtures, 'publisherAccount'>
> = async ({ publisherAccount }, use) => {
	const client = new LogStoreClient({
		...CONFIG_TEST,
		auth: {
			privateKey: publisherAccount.privateKey,
		},
	});
	await use(client);

	await client.destroy();
};

const useStream: Resource<
	StreamBag,
	Pick<Fixtures, 'publisherClient' | 'consumerClient'>
> = async ({ publisherClient, consumerClient }, use) => {
	const stream = await createTestStream(publisherClient, 'temp-unique-id', {
		partitions: 1,
	});
	await stream.grantPermissions({
		user: await consumerClient.getAddress(),
		permissions: [StreamPermission.SUBSCRIBE],
	});

	async function publishManyMessages(numOfMessages: number) {
		const messages: Message[] = [];
		for (const idx of range(numOfMessages)) {
			const message = await publisherClient.publish(
				{
					id: stream.id,
					partition: 0,
				},
				{
					messageNo: idx,
				}
			);
			messages.push(message);
		}
	}

	await use({ instance: stream, publishManyMessages });
};

// this extended version provides necessary fixtures to run the tests
// export const testLS = test.extend<Fixtures>({
// 	// on playwright, ordering isn't important as long as there are no circular references
// 	// however this isn't implemented on vitest-fixtures, so I guess we will pay attention here manually
// 	// also, here things will be executed in sequence, and not in parallel
// 	provider: [useProvider, { scope: 'test' }],
// 	publisherAccount: [usePublisherAccount, { scope: 'test' }],
// 	storeOwnerAccount: [useStoreOwnerAccount, { scope: 'test' }],
// 	storeConsumerAccount: [useStoreConsumerAccount, { scope: 'test' }],
// 	publisherClient: [usePublisherClient, { scope: 'test' }],
// 	consumerClient: [useConsumerClient, { scope: 'test' }],
// 	stream: [useStream, { scope: 'test' }],
// 	storeManager: [useStoreManager, { scope: 'test' }],
// 	queryManager: [useQueryManager, { scope: 'test' }],
// });
