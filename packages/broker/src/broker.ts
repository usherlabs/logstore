import {
	LogStoreClient,
	validateConfig as validateLogStoreClientConfig,
} from '@logsn/client';
import { getNodeManagerContract } from '@logsn/shared';
import { toStreamID } from '@streamr/protocol';
import { Logger, toEthereumAddress } from '@streamr/utils';
import { ethers } from 'ethers';
import { Server as HttpServer } from 'http';
import { Server as HttpsServer } from 'https';
import {
	NetworkNodeStub,
	PrivateKeyAuthConfig,
	StreamrClient,
} from 'streamr-client';

import { version as CURRENT_VERSION } from '../package.json';
import { Config } from './config/config';
import BROKER_CONFIG_SCHEMA from './config/config.schema.json';
import { validateConfig } from './config/validateConfig';
import { generateMnemonicFromAddress } from './helpers/generateMnemonicFromAddress';
import { startServer as startHttpServer, stopServer } from './httpServer';
import { HttpServerEndpoint, Plugin, PluginOptions } from './Plugin';
import { createPlugin } from './pluginRegistry';

const logger = new Logger(module);

export interface Broker {
	getNode: () => Promise<NetworkNodeStub>;
	start: () => Promise<unknown>;
	stop: () => Promise<unknown>;
}

export const createBroker = async (
	configWithoutDefaults: Config
): Promise<Broker> => {
	const config = validateConfig(configWithoutDefaults, BROKER_CONFIG_SCHEMA);
	validateLogStoreClientConfig(config.logStoreClient);

	// Tweaks suggested by the Streamr Team
	config.streamrClient.network!.webrtcSendBufferMaxMessageCount = 5000;
	config.streamrClient.gapFill = true;
	config.streamrClient.gapFillTimeout = 30 * 1000;

	const streamrClientConfig = config.streamrClient;
	const streamrClient = new StreamrClient(streamrClientConfig);
	const logStoreClient = new LogStoreClient(
		streamrClient,
		config.logStoreClient
	);

	const nodeManagerAddress = toEthereumAddress(
		config.logStoreClient.contracts!.logStoreNodeManagerChainAddress!
	);

	const heartbeatStreamId = toStreamID('/heartbeat', nodeManagerAddress);
	const recoveryStreamId = toStreamID('/recovery', nodeManagerAddress);
	const systemStreamId = toStreamID('/system', nodeManagerAddress);
	const topicsStreamId = toStreamID('/topics', nodeManagerAddress);

	const heartbeatStream = await streamrClient.getStream(heartbeatStreamId);
	const recoveryStream = await streamrClient.getStream(recoveryStreamId);
	const systemStream = await streamrClient.getStream(systemStreamId);
	const topicsStream = await streamrClient.getStream(topicsStreamId);

	const privateKey = (config.streamrClient!.auth as PrivateKeyAuthConfig)
		.privateKey;

	const provider = new ethers.providers.JsonRpcProvider(
		config.streamrClient!.contracts?.streamRegistryChainRPCs!.rpcs[0]
	);
	const signer = new ethers.Wallet(privateKey, provider);

	const nodeManger = await getNodeManagerContract(signer);

	const plugins: Plugin<any>[] = Object.keys(config.plugins).map((name) => {
		const pluginOptions: PluginOptions = {
			name,
			logStoreClient,
			streamrClient,
			heartbeatStream,
			recoveryStream,
			systemStream,
			topicsStream,
			brokerConfig: config,
			signer,
			nodeManger,
		};
		return createPlugin(name, pluginOptions);
	});

	let started = false;
	let httpServer: HttpServer | HttpsServer | undefined;

	const getNode = async (): Promise<NetworkNodeStub> => {
		if (!started) {
			throw new Error('cannot invoke on non-started broker');
		}
		return streamrClient.getNode();
	};

	return {
		getNode,
		start: async () => {
			logger.info(`Starting LogStore broker version ${CURRENT_VERSION}`);
			await Promise.all(plugins.map((plugin) => plugin.start()));
			const httpServerEndpoints = plugins.flatMap((plugin: Plugin<any>) => {
				return plugin
					.getHttpServerEndpoints()
					.map((endpoint: HttpServerEndpoint) => {
						return {
							...endpoint,
						};
					});
			});
			if (httpServerEndpoints.length > 0) {
				httpServer = await startHttpServer(
					httpServerEndpoints,
					config.httpServer
				);
			}

			const nodeId = (await streamrClient.getNode()).getNodeId();
			const brokerAddress = await streamrClient.getAddress();
			const mnemonic = generateMnemonicFromAddress(
				toEthereumAddress(brokerAddress)
			);

			logger.info(
				`Welcome to the LogStore Network. Your node's generated name is ${mnemonic}.`
			);
			// TODO: Network Explorer link
			logger.info(
				`View your node in the Network Explorer: https://streamr.network/network-explorer/nodes/${encodeURIComponent(
					nodeId
				)}`
			);
			logger.info(`Network node ${nodeId} running`);
			logger.info(`Ethereum address ${brokerAddress}`);
			logger.info(
				`Tracker Configuration: ${
					config.streamrClient.network?.trackers
						? JSON.stringify(config.streamrClient.network?.trackers)
						: 'default'
				}`
			);

			logger.info(`Plugins: ${JSON.stringify(plugins.map((p) => p.name))}`);

			if (
				config.streamrClient.network?.webrtcDisallowPrivateAddresses ===
					undefined ||
				config.streamrClient.network.webrtcDisallowPrivateAddresses
			) {
				logger.warn(
					'WebRTC private address probing is disabled. ' +
						'This makes it impossible to create network layer connections directly via local routers ' +
						'More info: https://github.com/streamr-dev/network-monorepo/wiki/WebRTC-private-addresses'
				);
			}
			started = true;
		},
		stop: async () => {
			if (httpServer !== undefined) {
				await stopServer(httpServer);
			}
			await Promise.all(plugins.map((plugin) => plugin.stop()));
			await streamrClient.destroy();
		},
	};
};

process.on('uncaughtException', (err) => {
	logger.fatal('Encountered uncaughtException', { err });
	process.exit(1);
});

process.on('unhandledRejection', (err) => {
	logger.fatal('Encountered unhandledRejection', { err });
	process.exit(1);
});
