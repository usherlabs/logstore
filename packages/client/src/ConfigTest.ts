import { CONFIG_TEST as STREAMR_CONFIG_TEST } from 'streamr-client';

import { LogStoreClientConfig } from './LogStoreClientConfig';

/**
 * LogStore client constructor options that work in the test environment
 */
export const CONFIG_TEST: LogStoreClientConfig = {
	...STREAMR_CONFIG_TEST,
	contracts: {
		...STREAMR_CONFIG_TEST.contracts,
		logStoreManagerChainAddress: '0x611900fD07BB133016Ed85553aF9586771da5ff9',
		logStoreTheGraphUrl:
			'http://127.0.0.1:8000/subgraphs/name/logstore-dev/network-contracts',
	},
};
