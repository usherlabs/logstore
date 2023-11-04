import { LogStoreClient } from '@logsn/client';
import { fetchPrivateKeyWithGas } from '@streamr/test-utils';
import { ethers } from 'ethers';
import { describe, expect, test as rawTest } from 'vitest';

import { createTestStream } from '../../client/test/test-utils/utils';
import { executeOnCli, getTestLogStoreClient } from './utils';

const TEST_TIMEOUT = 90_000;

const test = rawTest.extend<{
	walletPrivateKey: string;
	logstoreClient: LogStoreClient;
	provider: ethers.providers.JsonRpcProvider;
	credentialsString: string;
}>({
	walletPrivateKey: async ({}, use) => {
		const privateKey = await fetchPrivateKeyWithGas();
		await use(privateKey);
	},
	logstoreClient: async ({ walletPrivateKey }, use) => {
		const logstoreClient = getTestLogStoreClient(walletPrivateKey);
		await use(logstoreClient);
		await logstoreClient.destroy();
	},
	provider: async ({ logstoreClient }, use) => {
		const config = logstoreClient.getConfig();
		const provider = new ethers.providers.JsonRpcProvider(
			config.contracts.streamRegistryChainRPCs.rpcs[0].url,
			config.contracts.streamRegistryChainRPCs.chainId
		);
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
			expect(stdout).toContain(
				'of Storage are available to be staked on the Log Store'
			);
			expect(stdout).toContain(
				'of Queries are available to be staked on the Log Store'
			);
		},
		TEST_TIMEOUT
	);

	test(
		'mint',
		async ({ credentialsString, logstoreClient }) => {
			const MINT_AMOUNT = 100_000_000_000_000n;
			const mintWei = MINT_AMOUNT;

			const balance = await logstoreClient.getBalance();
			const price = await logstoreClient.getPrice();

			const mintResult = mintWei / price;
			const expectedBalance = balance + mintResult;

			const { code, stdout } = await executeOnCli(
				`mint ${mintWei} ${credentialsString} `
			);

			expect(code).toBe(0);
			expect(stdout).toContain('Successfully minted tokens to network:Tx');
			expect(stdout).toContain('Amount:Tx 100000000000000');

			const newBalance = await logstoreClient.getBalance();

			expect(newBalance).toBe(expectedBalance);
		},
		TEST_TIMEOUT
	);

	test(
		'mint with usd',
		async ({ credentialsString, logstoreClient }) => {
			const MINT_AMOUNT_USD = '0.001';
			const mintResult = await logstoreClient.convert({
				amount: MINT_AMOUNT_USD,
				from: 'usd',
				to: 'bytes',
			});

			const balance = await logstoreClient.getBalance();

			const expectedBalance = balance + BigInt(mintResult);

			const { code, stdout, stderr } = await executeOnCli(
				`mint -u ${MINT_AMOUNT_USD} ${credentialsString} `
			);

			expect(code).toBe(0);
			expect(stderr).toBe('');
			expect(stdout).toContain('Successfully minted tokens to network:Tx');
			expect(stdout).toContain('Amount:Tx ');

			const newBalance = await logstoreClient.getBalance();

			expect(newBalance).toBe(BigInt(expectedBalance));
		},
		TEST_TIMEOUT
	);

	test(
		'mint big value with usd',
		async ({ credentialsString, logstoreClient }) => {
			const MINT_AMOUNT_USD = '999';
			const mintResult = await logstoreClient.convert({
				amount: MINT_AMOUNT_USD,
				from: 'usd',
				to: 'bytes',
			});

			const balance = await logstoreClient.getBalance();

			const expectedBalance = balance + BigInt(mintResult);

			const { code, stdout, stderr } = await executeOnCli(
				`mint -u ${MINT_AMOUNT_USD} ${credentialsString} `
			);

			expect(code).toBe(0);
			expect(stderr).toBe('');
			expect(stdout).toContain('Successfully minted tokens to network:Tx');
			expect(stdout).toContain('Amount:Tx ');

			const newBalance = await logstoreClient.getBalance();

			expect(newBalance).toBe(BigInt(expectedBalance));
		},
		TEST_TIMEOUT
	);

	test(
		'query stake',
		async ({ logstoreClient, credentialsString }) => {
			const previousQueryBalance = await logstoreClient.getQueryBalance();

			const STAKE_AMOUNT = 100_000_000_000_000n;

			const { code, stdout } = await executeOnCli(
				`query stake -y ${STAKE_AMOUNT} ${credentialsString}`
			);

			expect(code).toBe(0);
			expect(stdout).toContain('Successfully staked 100000000000000 - Tx');

			const queryBalance = await logstoreClient.getQueryBalance();

			expect(queryBalance).toBe(previousQueryBalance + STAKE_AMOUNT);
		},
		TEST_TIMEOUT * 4
	);

	test(
		'store stake',
		async ({ credentialsString, logstoreClient }) => {
			const previousStoreBalance = await logstoreClient.getStoreBalance();
			const STAKE_AMOUNT = 100_000_000_000_000n;

			const stream = await createTestStream(logstoreClient, {
				filename: __filename,
			});

			const { code, stdout, stderr } = await executeOnCli(
				`store stake -y ${stream.id} ${STAKE_AMOUNT} ${credentialsString}`
			);

			expect(stderr).toBe('');
			expect(code).toBe(0);
			expect(stdout).toContain('Successfully staked 100000000000000 - Tx');

			const storeBalance = await logstoreClient.getStoreBalance();
			const streamStakeBalance = await logstoreClient.getStreamBalance(
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
			expect(stdout).toContain('LSAN in a Wallet UI');
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
			expect(stdout).toContain('LSAN in a Wallet UI');
			expect(stdout).toContain('of data is available for Storage');
		},
		TEST_TIMEOUT
	);
});
