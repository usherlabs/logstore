import {
	CONFIG_TEST as LOGSTORE_CLIENT_CONFIG_TEST,
	LogStoreClient,
} from '@logsn/client';
import { TEST_CONFIG } from '@streamr/network-node';
import { startTracker, Tracker } from '@streamr/network-tracker';
import {
	EthereumAddress,
	MetricsContext,
	toEthereumAddress,
} from '@streamr/utils';
import { Wallet } from 'ethers';
import _ from 'lodash';
import { StreamrClientConfig } from 'streamr-broker';
import {
	Stream,
	StreamMetadata,
	CONFIG_TEST as STREAMR_CLIENT_CONFIG_TEST,
	StreamrClient,
} from 'streamr-client';

import { Broker, createBroker as createLogStoreBroker } from '../src/broker';
import { Config } from '../src/config/config';

export const STREAMR_DOCKER_DEV_HOST =
	process.env.STREAMR_DOCKER_DEV_HOST || '127.0.0.1';

interface LogStoreBrokerTestConfig {
	trackerPort?: number;
	privateKey: string;
	extraPlugins?: Record<string, unknown>;
	keyspace?: string;
	logStoreConfigRefreshInterval?: number;
	httpServerPort?: number;
}

export const formLogStoreBrokerConfig = ({
	trackerPort,
	privateKey,
	extraPlugins = {},
	keyspace = 'logstore_test',
	logStoreConfigRefreshInterval = 0,
	httpServerPort = 7171,
}: LogStoreBrokerTestConfig): Config => {
	const plugins: Record<string, any> = { ...extraPlugins };
	plugins['logStore'] = {
		cassandra: {
			hosts: [STREAMR_DOCKER_DEV_HOST],
			datacenter: 'datacenter1',
			username: '',
			password: '',
			keyspace,
		},
		logStoreConfig: {
			refreshInterval: logStoreConfigRefreshInterval,
		},
	};

	return {
		logStoreClient: {
			...LOGSTORE_CLIENT_CONFIG_TEST,
		},
		streamrClient: {
			...STREAMR_CLIENT_CONFIG_TEST,
			logLevel: 'trace',
			auth: {
				privateKey,
			},
			network: {
				id: toEthereumAddress(new Wallet(privateKey).address),
				trackers: trackerPort
					? [
							{
								id: createEthereumAddress(trackerPort),
								ws: `ws://127.0.0.1:${trackerPort}`,
								http: `http://127.0.0.1:${trackerPort}`,
							},
					  ]
					: STREAMR_CLIENT_CONFIG_TEST.network?.trackers,
				location: {
					latitude: 60.19,
					longitude: 24.95,
					country: 'Finland',
					city: 'Helsinki',
				},
				webrtcDisallowPrivateAddresses: false,
			},
		},
		plugins,
		httpServer: {
			port: httpServerPort,
		},
	};
};

export const startTestTracker = async (port: number): Promise<Tracker> => {
	return await startTracker({
		id: createEthereumAddress(port),
		listen: {
			hostname: '127.0.0.1',
			port,
		},
		metricsContext: new MetricsContext(),
		trackerPingInterval: TEST_CONFIG.trackerPingInterval,
	});
};

export const startLogStoreBroker = async (
	testConfig: LogStoreBrokerTestConfig
): Promise<Broker> => {
	const broker = await createLogStoreBroker(
		formLogStoreBrokerConfig(testConfig)
	);
	await broker.start();
	return broker;
};

export const createEthereumAddress = (id: number): EthereumAddress => {
	return toEthereumAddress('0x' + _.padEnd(String(id), 40, '0'));
};

export const createStreamrClient = async (
	tracker: Tracker,
	privateKey: string,
	clientOptions?: StreamrClientConfig
): Promise<StreamrClient> => {
	const networkOptions = {
		...STREAMR_CLIENT_CONFIG_TEST?.network,
		trackers: tracker
			? [tracker.getConfigRecord()]
			: STREAMR_CLIENT_CONFIG_TEST.network?.trackers,
		...clientOptions?.network,
	};

	return new StreamrClient({
		...STREAMR_CLIENT_CONFIG_TEST,
		logLevel: 'trace',
		auth: {
			privateKey,
		},
		network: networkOptions,
		...clientOptions,
	});
};

export const createLogStoreClient = async (
	streamrClient: StreamrClient
): Promise<LogStoreClient> => {
	return new LogStoreClient(streamrClient, {
		...LOGSTORE_CLIENT_CONFIG_TEST,
		logLevel: 'trace',
	});
};

export const getTestName = (module: NodeModule): string => {
	const fileNamePattern = new RegExp('.*/(.*).test\\...');
	const groups = module.filename.match(fileNamePattern);
	return groups !== null ? groups[1] : module.filename;
};

export const createTestStream = async (
	streamrClient: StreamrClient,
	module: NodeModule,
	props?: Partial<StreamMetadata>
): Promise<Stream> => {
	const id =
		(await streamrClient.getAddress()) +
		'/test/' +
		getTestName(module) +
		'/' +
		Date.now();
	const stream = await streamrClient.createStream({
		id,
		...props,
	});
	return stream;
};

export async function sleep(ms = 0): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}
