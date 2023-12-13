import type { StreamrClientConfig } from '@logsn/streamr-client';

export interface LogStoreClientConfig extends StreamrClientConfig {
	nodeUrl?: string;
	contracts?: StreamrClientConfig['contracts'] & {
		logStoreNodeManagerChainAddress?: string;
		logStoreStoreManagerChainAddress?: string;
		logStoreQueryManagerChainAddress?: string;
		logStoreTokenManagerChainAddress?: string;
		logStoreTheGraphUrl?: string;
	};
}
