import { CONFIG_TEST as STREAMR_CONFIG_TEST } from 'streamr-client';

import { LogStoreClientConfig } from './LogStoreClientConfig';

/**
 * LogStore client constructor options that work in the test environment
 */
export const CONFIG_TEST: LogStoreClientConfig = {
	...STREAMR_CONFIG_TEST,
	contracts: {
		...STREAMR_CONFIG_TEST.contracts,
		logStoreManagerChainAddress: '0x256D4CB67452b6b8280B2b67F040fD22f1C378f4',
		logStoreTheGraphUrl:
			'http://127.0.0.1:8000/subgraphs/name/logstore-dev/network-contracts',
	},
};
