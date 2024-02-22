import { getClientsForCredentials } from '@/utils/logstore-client';
import { exec } from 'child_process';
import path from 'path';
import { test as rawTest } from 'vitest';
import { ethers } from 'ethers';
import { fetchPrivateKeyWithGas } from '@streamr/test-utils';
import stripAnsi from 'strip-ansi';

const getCliPath = async () => {
	// gets package.json from the root of the project
	// gets property bin > logstore path
	// joins path to the root of the project
	// returns the path

	const pkg = await import(path.join(__dirname, '../package.json'));
	return path.join(__dirname, '../', pkg.bin.logstore);
};

const getTSCliPath = () => {
	const relativePath = '../bin/logstore-cli.ts';
	const logstoreCliPath = path.join(__dirname, relativePath);
	return logstoreCliPath;
};

/**
 * @param command
 * @param type -- this will define if we are running the cli from the source code or from the build
 */
export const executeOnCli = async (
	command: string,
	type: 'build' | 'dev' = 'dev',
	env: Record<string, string> = {}
) => {
	const cliPath = type === 'dev' ? getTSCliPath() : await getCliPath();
	const execCommand =
		type === 'dev'
			? `pnpm tsx -- ${cliPath} ${command}`
			: `node ${cliPath} ${command}`;
	console.log('executing: ', execCommand);
	return new Promise<{ stdout: string; stderr: string; code: number }>(
		(resolve) => {
			exec(
				execCommand,
				{
					env: {
						...process.env,
						...env,
					},
				},
				(error, stdout, stderr) => {
					resolve({
						stdout: stripAnsi(stdout),
						stderr: stripAnsi(stderr),
						code: error ? Number(error.code) : 0,
					});
				}
			);
		}
	);
};

export function getTestLogStoreClient(privateKey: string) {
	return getClientsForCredentials({
		host: 'http://localhost:8546',
		wallet: privateKey,
	});
}

export const test = rawTest.extend<{
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
