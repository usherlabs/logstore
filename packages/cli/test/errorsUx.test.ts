import { executeOnCli, getTestLogStoreClient, test as baseTest } from './utils';
import { fastWallet } from '@streamr/test-utils';
import { describe, expect } from 'vitest';
import { getClientsForCredentials } from '@/utils/logstore-client';

/*
 * !! This test runs on production environment. However the random wallets used should not move any funds.
 */
const test = baseTest.extend<{
	emptyWalletPk: string;
	emptyClients: ReturnType<typeof getTestLogStoreClient>;
	emptyCredentialsString: string;
	rpcUrl: string;
}>({
	rpcUrl: 'https://polygon-rpc.com',
	emptyWalletPk: async ({}, use) => {
		const privateKey = fastWallet();
		await use(privateKey.privateKey);
	},
	emptyClients: async ({ emptyWalletPk, rpcUrl }, use) => {
		const clients = getClientsForCredentials({
			host: rpcUrl,
			wallet: emptyWalletPk,
			isTest: false,
		});
		await use(clients);
		await clients.streamrClient.destroy();
		clients.logStoreClient.destroy();
	},
	emptyCredentialsString: async ({ emptyWalletPk, rpcUrl }, use) => {
		// const credentialsString = `-h http://localhost:8546 -w ${emptyWalletPk}`;
		const credentialsString = `-h ${rpcUrl} -w ${emptyWalletPk}`;

		await use(credentialsString);
	},
});

describe(
	'empty wallet tests',
	function () {
		test('query stake without funds', async ({ emptyCredentialsString }) => {
			const { stdout, code } = await executeOnCli(
				`query stake -y 1 ${emptyCredentialsString}`,
				'dev',
				{
					USE_TEST_CONFIG: 'false',
				}
			);
			expect(code).toBe(0);
			expect(stdout).toContain(
				'Please check if you have enough funds to cover the transaction fee.'
			);
		});

		test('issue command with a network that is not working', async ({
			emptyCredentialsString,
			rpcUrl,
		}) => {
			// right now we know https://polygon.llamarpc.com isn't working
			const newCredentials = emptyCredentialsString.replace(
				rpcUrl,
				'https://super-wrong-rpc.llamarpc.com'
			);

			const { stdout } = await executeOnCli(
				`balance ${newCredentials}`,
				'dev',
				{
					USE_TEST_CONFIG: 'false',
				}
			);

			// expect(code).toBe(0);
			expect(stdout).toContain('Please check if your');
		});
	},
	{
		timeout: 90_000,
	}
);
