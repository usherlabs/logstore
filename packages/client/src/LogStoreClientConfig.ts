import { StreamrClientConfig } from 'streamr-client';

export interface LogStoreClientConfig extends StreamrClientConfig {
	contracts?: StreamrClientConfig['contracts'] & {
		logStoreManagerChainAddress?: string;
		logStoreTheGraphUrl?: string;
	};
}
