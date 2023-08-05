import { getRootOptions } from '@/commands/options';
import { USE_TEST_CONFIG } from '@/env-config';
import { LogStoreClient } from '@logsn/client';
import { ethers } from 'ethers';

import { CONFIG_TEST } from '../../../client/src/ConfigTest';

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
	const additionalConfig = USE_TEST_CONFIG ? CONFIG_TEST : {};
	return new LogStoreClient({
		...additionalConfig,
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
