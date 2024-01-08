import { LogLevel } from 'streamr-client';

export interface LogStoreClientConfig {
	/** Custom human-readable debug id for client. Used in logging. */
	id?: string;
	logLevel?: LogLevel;
	nodeUrl?: string;
	contracts?: {
		logStoreNodeManagerChainAddress?: string;
		logStoreStoreManagerChainAddress?: string;
		logStoreQueryManagerChainAddress?: string;
		logStoreTokenManagerChainAddress?: string;
		logStoreTheGraphUrl?: string;
	};
}
