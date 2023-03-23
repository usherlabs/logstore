import { Logger, toEthereumAddress } from '@streamr/utils';
import StreamrClient, {
	NetworkNodeStub,
	validateConfig as validateClientConfig,
} from 'streamr-client';
import { container } from 'tsyringe';

import { version as CURRENT_VERSION } from '../package.json';
import {
	AuthenticationInjectionToken,
	createAuthentication,
} from './client/Authentication';
import {
	ClientConfigInjectionToken,
	createStrictConfig,
} from './client/Config';
import { Config } from './config/config';
import BROKER_CONFIG_SCHEMA from './config/config.schema.json';
import { validateConfig } from './config/validateConfig';
import { generateMnemonicFromAddress } from './helpers/generateMnemonicFromAddress';
import { Plugin, PluginOptions } from './Plugin';
import { createPlugin } from './pluginRegistry';
import { LogStorePluginConfigInjectionToken } from './plugins/logStore/LogStorePlugin';
import { LogStoreRegistry } from './registry/LogStoreRegistry';

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
	validateClientConfig(config.client);

	const streamrClient = new StreamrClient(config.client);

	const logStorePluginConfig = config.plugins['logStore'];
	const clientConfig = createStrictConfig(config.client);
	const authentication = createAuthentication(clientConfig);

	container.register(StreamrClient, {
		useValue: streamrClient,
	});

	container.register(AuthenticationInjectionToken, {
		useValue: authentication,
	});

	container.register(ClientConfigInjectionToken, {
		useValue: clientConfig,
	});

	container.register(LogStorePluginConfigInjectionToken, {
		useValue: logStorePluginConfig,
	});

	const logStoreRegistry =
		container.resolve<LogStoreRegistry>(LogStoreRegistry);

	const plugins: Plugin<any>[] = Object.keys(config.plugins).map((name) => {
		const pluginOptions: PluginOptions = {
			name,
			streamrClient,
			brokerConfig: config,
			logStoreRegistry,
		};
		return createPlugin(name, pluginOptions);
	});

	let started = false;

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
					config.client.network?.trackers
						? JSON.stringify(config.client.network?.trackers)
						: 'default'
				}`
			);

			logger.info(`Plugins: ${JSON.stringify(plugins.map((p) => p.name))}`);

			if (
				config.client.network?.webrtcDisallowPrivateAddresses === undefined ||
				config.client.network.webrtcDisallowPrivateAddresses
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
			await Promise.all(plugins.map((plugin) => plugin.stop()));
			await streamrClient.destroy();
		},
	};
};

process.on('uncaughtException', (err) => {
	logger.getFinalLogger().error(err, 'uncaughtException');
	process.exit(1);
});

process.on('unhandledRejection', (err) => {
	logger.getFinalLogger().error(err, 'unhandledRejection');
	process.exit(1);
});
