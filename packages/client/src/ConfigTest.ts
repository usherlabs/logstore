import { CONFIG_TEST as STREAMR_CONFIG_TEST } from 'streamr-client';

import { LogStoreClientConfig } from './LogStoreClientConfig';

/**
 * LogStore client constructor options that work in the test environment
 */
export const CONFIG_TEST: LogStoreClientConfig = {
	...STREAMR_CONFIG_TEST,
	contracts: {
		...STREAMR_CONFIG_TEST.contracts,
		logStoreManagerChainAddress: '0x73A4bB647CdD4b45717A255960B865d6Ad5b8c38',
		logStoreTheGraphUrl:
			'http://127.0.0.1:8000/subgraphs/name/logstore-dev/network-contracts',
	},
};
