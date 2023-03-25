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
import StreamrClient, {
	Stream,
	StreamMetadata,
	CONFIG_TEST as STREAMR_CONFIG_TEST,
	StreamrClientConfig,
} from 'streamr-client';

import { Broker, createBroker as createLogStoreBroker } from '../src/broker';
import { CONFIG_TEST as LOGSTORE_CONFIG_TEST } from '../src/client/ConfigTest';
import { LogStoreClient } from '../src/client/LogStoreClient';
import { LogStoreClientConfig } from '../src/client/LogStoreClientConfig';
import { Config } from '../src/config/config';

export const STREAMR_DOCKER_DEV_HOST =
	process.env.STREAMR_DOCKER_DEV_HOST || '127.0.0.1';

interface StreamrBrokerTestConfig {
	trackerPort: number;
	privateKey: string;
	extraPlugins?: Record<string, unknown>;
}

interface LogStoreBrokerTestConfig {
	trackerPort: number;
	privateKey: string;
	extraPlugins?: Record<string, unknown>;
	enableCassandra?: boolean;
	logStoreConfigRefreshInterval?: number;
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
	enableCassandra = false,
	logStoreConfigRefreshInterval = 0,
}: LogStoreBrokerTestConfig): Config => {
	const plugins: Record<string, any> = { ...extraPlugins };
	if (enableCassandra) {
		plugins['logStore'] = {
			cassandra: {
				hosts: [STREAMR_DOCKER_DEV_HOST],
				datacenter: 'datacenter1',
				username: '',
				password: '',
				keyspace: 'logstore_dev',
			},
			logStoreConfig: {
				refreshInterval: logStoreConfigRefreshInterval,
				// logStoreManagerChainAddress,
			},
		};
	}

	return {
		client: {
			...LOGSTORE_CONFIG_TEST,
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

export const createStreamrClient = async (
	tracker: Tracker,
	privateKey: string,
	clientOptions?: StreamrClientConfig
): Promise<StreamrClient> => {
	const networkOptions = {
		...STREAMR_CONFIG_TEST?.network,
		trackers: [tracker.getConfigRecord()],
		...clientOptions?.network,
	};

	return new StreamrClient({
		...STREAMR_CONFIG_TEST,
		logLevel: 'trace',
		auth: {
			privateKey,
		},
		network: networkOptions,
		...clientOptions,
	});
};

export const createLogStoreClient = async (
	tracker: Tracker,
	privateKey: string,
	clientOptions?: LogStoreClientConfig
): Promise<LogStoreClient> => {
	const networkOptions = {
		...LOGSTORE_CONFIG_TEST?.network,
		trackers: [tracker.getConfigRecord()],
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
