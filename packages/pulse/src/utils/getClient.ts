import {
	CONFIG_TEST as LOGSTORE_CONFIG_TEST,
	LogStoreClient,
	LogStoreClientConfig,
} from '@logsn/client';
import StreamrClient, {
	CONFIG_TEST as STREAMR_CONFIG_TEST,
	StreamrClientConfig,
} from '@streamr/sdk';

export const getClients = (privateKey: string, dev: boolean = false) => {
	const streamrConfig: StreamrClientConfig = {
		...(dev ? STREAMR_CONFIG_TEST : {}),
		auth: {
			privateKey,
		},
	};

	const logStoreConfig: LogStoreClientConfig = {
		...(dev ? LOGSTORE_CONFIG_TEST : {}),
	};

	const streamrClient = new StreamrClient(streamrConfig);
	const logStoreClient = new LogStoreClient(streamrClient, logStoreConfig);

	return { logStoreClient, streamrClient };
};
