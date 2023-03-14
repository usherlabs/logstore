import { TEST_CONFIG } from '@streamr/network-node';
import { startTracker, Tracker } from '@streamr/network-tracker';
// import { StreamPartID } from '@streamr/protocol';
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
	CONFIG_TEST,
	Stream,
	StreamMetadata,
	StreamrClientConfig,
} from 'streamr-client';

import { Broker, createBroker } from '../src/broker';
import { Config } from '../src/config/config';

export const STREAMR_DOCKER_DEV_HOST =
	process.env.STREAMR_DOCKER_DEV_HOST || '127.0.0.1';

interface TestConfig {
	trackerPort: number;
	privateKey: string;
	httpPort?: number;
	extraPlugins?: Record<string, unknown>;
	apiAuthentication?: Config['apiAuthentication'];
	enableCassandra?: boolean;
	logStoreConfigRefreshInterval?: number;
	logStoreManagerChainAddress?: string;
	theGraphUrl?: string;
}

export const formConfig = ({
	trackerPort,
	privateKey,
	httpPort,
	extraPlugins = {},
	apiAuthentication,
	enableCassandra = false,
	logStoreConfigRefreshInterval = 0,
	logStoreManagerChainAddress,
}: TestConfig): Config => {
	const plugins: Record<string, any> = { ...extraPlugins };
	if (httpPort) {
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
					logStoreManagerChainAddress,
				},
			};
		}
	}

	return {
		client: {
			...CONFIG_TEST,
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
		httpServer: {
			port: httpPort ? httpPort : 7171,
		},
		apiAuthentication,
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

export const startBroker = async (testConfig: TestConfig): Promise<Broker> => {
	const broker = await createBroker(formConfig(testConfig));
	await broker.start();
	return broker;
};

export const startStreamrBroker = async (
	testConfig: TestConfig
): Promise<StreamrBroker> => {
	const broker = await createStreamrBroker(formConfig(testConfig));
	await broker.start();
	return broker;
};

export const createEthereumAddress = (id: number): EthereumAddress => {
	return toEthereumAddress('0x' + _.padEnd(String(id), 40, '0'));
};

export const createClient = async (
	tracker: Tracker,
	privateKey: string,
	clientOptions?: StreamrClientConfig
): Promise<StreamrClient> => {
	const networkOptions = {
		...CONFIG_TEST?.network,
		trackers: [tracker.getConfigRecord()],
		...clientOptions?.network,
	};

	const clientConfig = {
		...CONFIG_TEST,
		logLevel: 'trace',
		auth: {
			privateKey,
		},
		network: networkOptions,
		...clientOptions,
	} as StreamrClientConfig;
	// console.log(JSON.stringify(clientConfig, null, 2));
	return new StreamrClient(clientConfig);

	// return new StreamrClient({
	// 	...CONFIG_TEST,
	// 	auth: {
	// 		privateKey,
	// 	},
	// 	network: networkOptions,
	// 	...clientOptions,
	// });
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

// export const getStreamParts = async (
// 	broker: Broker
// ): Promise<StreamPartID[]> => {
// 	const node = await broker.getNode();
// 	return Array.from(node.getStreamParts());
// };

export async function sleep(ms = 0): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

export async function startLogStoreBroker(
	logStoreNodePrivateKey: string,
	httpPort: number,
	trackerPort: number
): Promise<Broker> {
	return startBroker({
		privateKey: logStoreNodePrivateKey,
		trackerPort,
		httpPort,
		enableCassandra: true,
		logStoreManagerChainAddress: '0x699B4bE95614f017Bb622e427d3232837Cc814E6',
		theGraphUrl:
			'http://10.200.10.1:8000/subgraphs/name/logstore-dev/network-contracts',
	});
}
