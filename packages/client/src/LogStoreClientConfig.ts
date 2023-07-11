import type { StreamrClientConfig } from '@logsn/streamr-client';

export interface LogStoreClientConfig extends StreamrClientConfig {
	contracts?: StreamrClientConfig['contracts'] & {
		logStoreNodeManagerChainAddress?: string;
		logStoreStoreManagerChainAddress?: string;
		logStoreTheGraphUrl?: string;
	};
}
