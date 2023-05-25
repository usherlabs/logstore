import {
	CONFIG_TEST as LOGSTORE_CONFIG_TEST,
	LogStoreClient,
	LogStoreClientConfig,
	Stream,
	StreamMetadata,
	CONFIG_TEST as STREAMR_CONFIG_TEST,
} from '@concertodao/logstore-client';
import { TEST_CONFIG } from '@streamr/network-node';
import { startTracker, Tracker } from '@streamr/network-tracker';
import {
	EthereumAddress,
	MetricsContext,
	toEthereumAddress,
} from '@streamr/utils';
import { Wallet } from 'ethers';
import _ from 'lodash';
import {
	createBroker as createStreamrBroker,
	Broker as StreamrBroker,
} from 'streamr-broker';

import { Broker, createBroker as createLogStoreBroker } from '../src/broker';
import { Config } from '../src/config/config';

export const STREAMR_DOCKER_DEV_HOST =
	process.env.STREAMR_DOCKER_DEV_HOST || '127.0.0.1';

interface StreamrBrokerTestConfig {
	trackerPort: number;
	privateKey: string;
	extraPlugins?: Record<string, unknown>;
}

interface LogStoreBrokerTestConfig {
	trackerPort?: number;
	privateKey: string;
	extraPlugins?: Record<string, unknown>;
	keyspace?: string;
	logStoreConfigRefreshInterval?: number;
	httpServerPort?: number;
}

export const formStreamrBrokerConfig = ({
	trackerPort,
	privateKey,
	extraPlugins = {},
}: StreamrBrokerTestConfig): Config => {
	const plugins: Record<string, any> = { ...extraPlugins };

	return {
		client: {
			...STREAMR_CONFIG_TEST,
			logLevel: 'trace',
			auth: {
				privateKey,
			},
			network: {
				id: toEthereumAddress(new Wallet(privateKey).address),
				trackers: [
					{
						id: createEthereumAddress(trackerPort),
						ws: `ws://127.0.0.1:${trackerPort}`,
						http: `http://127.0.0.1:${trackerPort}`,
					},
				],
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
	};
};
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
			// logStoreManagerChainAddress,
		},
	};

	return {
		client: {
			...LOGSTORE_CONFIG_TEST,
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
					: LOGSTORE_CONFIG_TEST.network?.trackers,
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

export const startStreamrBroker = async (
	testConfig: StreamrBrokerTestConfig
): Promise<StreamrBroker> => {
	const broker = await createStreamrBroker(formStreamrBrokerConfig(testConfig));
	await broker.start();
	return broker;
};

export const createEthereumAddress = (id: number): EthereumAddress => {
	return toEthereumAddress('0x' + _.padEnd(String(id), 40, '0'));
};

export const createLogStoreClient = async (
	tracker: Tracker,
	privateKey: string,
	clientOptions?: LogStoreClientConfig
): Promise<LogStoreClient> => {
	const networkOptions = {
		...LOGSTORE_CONFIG_TEST?.network,
		trackers: tracker
			? [tracker.getConfigRecord()]
			: STREAMR_CONFIG_TEST.network?.trackers,
		...clientOptions?.network,
	};

	return new LogStoreClient({
		...LOGSTORE_CONFIG_TEST,
		logLevel: 'trace',
		auth: {
			privateKey,
		},
		network: networkOptions,
		...clientOptions,
	});
};

export const getTestName = (module: NodeModule): string => {
	const fileNamePattern = new RegExp('.*/(.*).test\\...');
	const groups = module.filename.match(fileNamePattern);
	return groups !== null ? groups[1] : module.filename;
};

export const createTestStream = async (
	logStoreClient: LogStoreClient,
	module: NodeModule,
	props?: Partial<StreamMetadata>
): Promise<Stream> => {
	const id =
		(await logStoreClient.getAddress()) +
		'/test/' +
		getTestName(module) +
		'/' +
		Date.now();
	const stream = await logStoreClient.createStream({
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
