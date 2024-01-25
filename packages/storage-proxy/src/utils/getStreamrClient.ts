import StreamrClient, {
	CONFIG_TEST,
	StreamrClientConfig,
} from 'streamr-client';

interface Options {
	devNetwork?: boolean;
	privateKey: string;
}

export const getStreamrClient = ({ privateKey, devNetwork }: Options) => {
	const streamrConfig: StreamrClientConfig = {
		...(devNetwork ? CONFIG_TEST : {}),
		auth: {
			privateKey,
		},
	};

	return new StreamrClient(streamrConfig);
};
