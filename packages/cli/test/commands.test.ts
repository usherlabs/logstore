import { fetchPrivateKeyWithGas } from '@streamr/test-utils';
import { ethers } from 'ethers';
import stripAnsi from 'strip-ansi';
import { describe, expect, test as rawTest } from 'vitest';

import { createTestStream } from '../../client/test/test-utils/utils';
import { executeOnCli, getTestLogStoreClient } from './utils';

const TEST_TIMEOUT = 90_000;

const test = rawTest.extend<{
	walletPrivateKey: string;
	clients: ReturnType<typeof getTestLogStoreClient>;
	provider: ethers.providers.Provider;
	credentialsString: string;
}>({
	walletPrivateKey: async ({}, use) => {
		const privateKey = await fetchPrivateKeyWithGas();
		await use(privateKey);
	},
	clients: async ({ walletPrivateKey }, use) => {
		const clients = getTestLogStoreClient(walletPrivateKey);
		await use(clients);
		await clients.streamrClient.destroy();
		clients.logStoreClient.destroy();
	},
	provider: async ({ clients: { logStoreClient } }, use) => {
		const signer = await logStoreClient.getSigner();
		const provider = signer.provider;
		if (!provider) {
			throw new Error('No provider');
		}
		await use(provider);
	},
	credentialsString: async ({ walletPrivateKey }, use) => {
		const credentialsString = `-h http://localhost:8546 -w ${walletPrivateKey}`;
		await use(credentialsString);
	},
});

describe('direct cli call tests', function () {
	test(
		'version',
		async () => {
			const { stdout, code } = await executeOnCli('version');
			const expectedPart = '@logsn/cli version:';
			expect(code).toBe(0);
			expect(stdout).toContain(expectedPart);
		},
		TEST_TIMEOUT
	);

	test(
		'balance',
		async ({ credentialsString }) => {
			const { stdout, code } = await executeOnCli(
				'balance ' + credentialsString
			);
			expect(code).toBe(0);
			expect(stdout).toContain('The LSAN balance for address');
			expect(stdout).toContain('TB of Storage');
			expect(stdout).toContain('TB of Queries');
		},
		TEST_TIMEOUT
	);

	test('list streams', async ({
		credentialsString,
		clients: { streamrClient },
	}) => {
		const { code, stdout } = await executeOnCli(
			`store list ${credentialsString}`
		);

		expect(code).toBe(0);
		expect(stripAnsi(stdout)).toContain(await streamrClient.getAddress());
	});

	test(
		'mint',
		async ({ credentialsString, clients: { logStoreClient } }) => {
			const MINT_AMOUNT = 100_000_000_000_000n;
			const mintWei = MINT_AMOUNT;

			const balance = await logStoreClient.getBalance();
			const price = await logStoreClient.getPrice();

			const mintResult = mintWei / price;
			const expectedBalance = balance + mintResult;

			const { code, stdout } = await executeOnCli(
				`mint ${mintWei} ${credentialsString} `
			);

			expect(code).toBe(0);
			expect(stdout).toContain('Successfully minted tokens to network');
			expect(stdout).toMatch(/Minted \d+ LSAN/);

			const newBalance = await logStoreClient.getBalance();

			expect(newBalance).toBe(expectedBalance);
		},
		TEST_TIMEOUT
	);

	test(
		'mint with usd',
		async ({ credentialsString, clients: { logStoreClient } }) => {
			const MINT_AMOUNT_USD = '0.001';
			const mintResult = await logStoreClient.convert({
				amount: MINT_AMOUNT_USD,
				from: 'usd',
				to: 'bytes',
			});

			const balance = await logStoreClient.getBalance();

			const expectedBalance = balance + BigInt(mintResult);

			const { code, stdout } = await executeOnCli(
				`mint -u ${MINT_AMOUNT_USD} ${credentialsString} `
			);

			expect(code).toBe(0);
			expect(stdout).toContain('Successfully minted tokens to network');
			expect(stdout).toMatch(/Minted \d+ LSAN/);

			const newBalance = await logStoreClient.getBalance();

			expect(newBalance).toBe(BigInt(expectedBalance));
		},
		TEST_TIMEOUT
	);

	test(
		'mint big value with usd',
		async ({ credentialsString, clients: { logStoreClient } }) => {
			const MINT_AMOUNT_USD = '999';
			const mintResult = await logStoreClient.convert({
				amount: MINT_AMOUNT_USD,
				from: 'usd',
				to: 'bytes',
			});

			const balance = await logStoreClient.getBalance();

			const expectedBalance = balance + BigInt(mintResult);

			const { code, stdout } = await executeOnCli(
				`mint -u ${MINT_AMOUNT_USD} ${credentialsString} `
			);

			const output = stripAnsi(stdout);
			expect(code).toBe(0);
			expect(output).toContain('Successfully minted tokens to network');
			expect(stdout).toMatch(/Minted \d+ LSAN/);

			const newBalance = await logStoreClient.getBalance();

			expect(newBalance).toBe(BigInt(expectedBalance));
		},
		TEST_TIMEOUT
	);

	test(
		'query stake',
		async ({ clients: { logStoreClient }, credentialsString }) => {
			const previousQueryBalance = await logStoreClient.getQueryBalance();

			const STAKE_AMOUNT = 100_000_000_000_000n;

			const { code, stdout } = await executeOnCli(
				`query stake -y ${STAKE_AMOUNT} ${credentialsString}`
			);

			expect(code).toBe(0);
			expect(stdout).toContain('Successfully staked 100000000000000');

			const queryBalance = await logStoreClient.getQueryBalance();

			expect(queryBalance).toBe(previousQueryBalance + STAKE_AMOUNT);
		},
		TEST_TIMEOUT * 4
	);

	test(
		'store stake',
		async ({
			credentialsString,
			clients: { logStoreClient, streamrClient },
		}) => {
			const previousStoreBalance = await logStoreClient.getStoreBalance();
			const STAKE_AMOUNT = 100_000_000_000_000n;

			// @ts-expect-error its a hack to run without module
			const stream = await createTestStream(streamrClient, {
				filename: __filename,
			});

			const { code, stdout, stderr } = await executeOnCli(
				`store stake -y ${stream.id} ${STAKE_AMOUNT} ${credentialsString}`
			);

			expect(stderr).toBe('');
			expect(code).toBe(0);
			expect(stdout).toContain('Successfully staked 100000000000000 LSAN');

			const storeBalance = await logStoreClient.getStoreBalance();
			const streamStakeBalance = await logStoreClient.getStreamBalance(
				stream.id
			);

			expect(streamStakeBalance).toBe(STAKE_AMOUNT);
			expect(storeBalance).toBe(previousStoreBalance + STAKE_AMOUNT);
		},
		TEST_TIMEOUT
	);

	test(
		'query balance',
		async ({ credentialsString }) => {
			const { code, stdout } = await executeOnCli(
				`query balance ${credentialsString}`
			);

			expect(code).toBe(0);
			expect(stdout).toContain('LSAN staked on-chain for Queries');
			expect(stdout).toContain('of data is available for Queries');
		},
		TEST_TIMEOUT
	);

	test(
		'store balance',
		async ({ credentialsString }) => {
			const { code, stdout } = await executeOnCli(
				`store balance ${credentialsString}`
			);

			expect(code).toBe(0);
			expect(stdout).toContain('LSAN staked on-chain for Storage');
			expect(stdout).toContain('of data is available for Storage');
		},
		TEST_TIMEOUT
	);

	test('contract errors are printed', async ({ credentialsString }) => {
		const { code, stdout } = await executeOnCli(`mint 1 ${credentialsString}`);
		const output = stripAnsi(stdout);
		expect(code).toBe(0); // it actually fails, but the code remains 0
		expect(output).toContain('cannot estimate gas');
	});
});
