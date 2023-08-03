import {
	CONFIG_TEST,
	LogStoreClient,
	LogStoreClientConfig,
} from '@logsn/client';

export const getClient = (privateKey: string, dev: boolean = false) => {
	const config: LogStoreClientConfig = {
		...(dev ? CONFIG_TEST : {}),
		auth: {
			privateKey,
		},
	};

	return new LogStoreClient(config);
};
