import { getRootOptions } from '@/commands/options';
import { USE_TEST_CONFIG } from '@/env-config';
import { logger } from '@/utils/utils';
import {
	CONFIG_TEST as LOGSTORE_CONFIG_TEST,
	LogStoreClient,
} from '@logsn/client';
import { ethers } from 'ethers';
import {
	CONFIG_TEST as STREAMR_CONFIG_TEST,
	StreamrClient,
} from 'streamr-client';

function getCredentialsFrom(host: string, wallet: string) {
	const provider = new ethers.providers.JsonRpcProvider(host);
	const signer = new ethers.Wallet(wallet, provider);
	return { provider, signer };
}

export function getCredentialsFromOptions() {
	const { wallet, host } = getRootOptions() as { wallet: string; host: string };
	return getCredentialsFrom(host, wallet);
}

export function getClientsForCredentials({
	host,
	wallet,
}: {
	host: string;
	wallet: string;
}) {
	const { provider } = getCredentialsFrom(host, wallet);
	const { logLevel: _unused, ...streamrConfig } = USE_TEST_CONFIG
		? STREAMR_CONFIG_TEST
		: ({} as never);
	const logStoreConfig = USE_TEST_CONFIG ? LOGSTORE_CONFIG_TEST : {};

	const logLevel = logger.settings.minLevel === 3 ? 'warn' : 'debug';
	if (!('LOG_LEVEL' in process.env)) {
		process.env.LOG_LEVEL = logLevel;
	}
	const streamrClient = new StreamrClient({
		...streamrConfig,
		logLevel: logLevel,
		auth: { privateKey: wallet },
		contracts: {
			...streamrConfig?.contracts,
			streamRegistryChainRPCs: {
				rpcs: [provider.connection],
				chainId: 8997,
				name: 'streamr',
			},
		},
	});
	const logStoreClient = new LogStoreClient(streamrClient, {
		logLevel,
		...logStoreConfig,
	});
	return { logStoreClient, streamrClient };
}

export const getClientsFromOptions = () => {
	const { wallet, host } = getRootOptions() as { wallet: string; host: string };
	return getClientsForCredentials({ host, wallet });
};
