import { getRootOptions } from '@/commands/options';
import { USE_TEST_CONFIG } from '@/env-config';
import { logger } from '@/utils/utils';
import { CONFIG_TEST, LogStoreClient } from '@logsn/client';
import { ethers } from 'ethers';

function getCredentialsFrom(host: string, wallet: string) {
	const provider = new ethers.providers.JsonRpcProvider(host);
	const signer = new ethers.Wallet(wallet, provider);
	return { provider, signer };
}

export function getCredentialsFromOptions() {
	const { wallet, host } = getRootOptions();
	return getCredentialsFrom(host, wallet);
}

export function getLogstoreClientForCredentials({
	host,
	wallet,
}: {
	host: string;
	wallet: string;
}) {
	const { provider } = getCredentialsFrom(host, wallet);
	const { logLevel: _unused, ...additionalConfig } = USE_TEST_CONFIG
		? CONFIG_TEST
		: {};
	const logLevel = logger.settings.minLevel === 3 ? 'warn' : 'debug';
	if (!('LOG_LEVEL' in process.env)) {
		process.env.LOG_LEVEL = logLevel;
	}
	return new LogStoreClient({
		...additionalConfig,
		logLevel: logLevel,
		auth: { privateKey: wallet },
		contracts: {
			...additionalConfig?.contracts,
			streamRegistryChainRPCs: {
				rpcs: [provider.connection],
				chainId: 8997,
				name: 'streamr',
			},
		},
	});
}

export const getLogStoreClientFromOptions = () => {
	const { wallet, host } = getRootOptions();
	return getLogstoreClientForCredentials({ host, wallet });
};
