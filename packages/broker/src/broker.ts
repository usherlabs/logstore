import { Logger, toEthereumAddress } from '@streamr/utils';
import 'reflect-metadata';
import { NetworkNodeStub } from 'streamr-client';

import { version as CURRENT_VERSION } from '../package.json';
import { validateConfig as validateClientConfig } from './client/Config';
import { LogStoreClient } from './client/LogStoreClient';
import { Config } from './config/config';
import BROKER_CONFIG_SCHEMA from './config/config.schema.json';
import { validateConfig } from './config/validateConfig';
import { generateMnemonicFromAddress } from './helpers/generateMnemonicFromAddress';
import { Plugin, PluginOptions } from './Plugin';
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
	validateClientConfig(config.client);

	const logStoreClient = new LogStoreClient(config.client);

	const plugins: Plugin<any>[] = Object.keys(config.plugins).map((name) => {
		const pluginOptions: PluginOptions = {
			name,
			logStoreClient,
			brokerConfig: config,
		};
		return createPlugin(name, pluginOptions);
	});

	let started = false;

	const getNode = async (): Promise<NetworkNodeStub> => {
		if (!started) {
			throw new Error('cannot invoke on non-started broker');
		}
		return logStoreClient.getNode();
	};

	return {
		getNode,
		start: async () => {
			logger.info(`Starting LogStore broker version ${CURRENT_VERSION}`);
			await Promise.all(plugins.map((plugin) => plugin.start()));

			const nodeId = (await logStoreClient.getNode()).getNodeId();
			const brokerAddress = await logStoreClient.getAddress();
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
			await logStoreClient.destroy();
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
