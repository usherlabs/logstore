import { validateConfig } from '@logsn/broker/dist/src/config/validateConfig';
import {
	LogStoreClient,
	NetworkNodeStub,
	PrivateKeyAuthConfig,
	validateConfig as validateClientConfig,
} from '@logsn/client';
import { getNodeManagerContract } from '@logsn/shared';
import { toStreamID } from '@streamr/protocol';
import { Logger, toEthereumAddress } from '@streamr/utils';
import { ethers } from 'ethers';

import { Config } from './config/config';
import OBSERVER_CONFIG_SCHEMA from './config/config.schema.json';
import { PACKAGE_NAME, PACKAGE_VERSION } from './constants';
import { Plugin, PluginOptions } from './Plugin';
import { createPlugin } from './pluginRegistry';
import { ctx } from './telemetry/context';
import { moduleFromMetaUrl } from './utils/moduleFromMetaUrl';

const logger = new Logger(moduleFromMetaUrl(import.meta?.url));

export interface LogstoreComponent {
	getNode: () => Promise<NetworkNodeStub>;
	start: () => Promise<unknown>;
	stop: () => Promise<unknown>;
}

export const createObserver = async (
	configWithoutDefaults: Config
): Promise<LogstoreComponent> => {
	const config = validateConfig(configWithoutDefaults, OBSERVER_CONFIG_SCHEMA);
	validateClientConfig(config.client);

	const logStoreClient = new LogStoreClient(config.client);

	// Tweaks suggested by the Streamr Team
	// Copied from @logsn/broker
	config.client.network!.webrtcSendBufferMaxMessageCount = 5000;
	config.client.gapFill = true;
	config.client.gapFillTimeout = 30 * 1000;

	const nodeManagerAddress = toEthereumAddress(
		config.client.contracts!.logStoreNodeManagerChainAddress!
	);

	const isDevNetwork =
		nodeManagerAddress ===
		toEthereumAddress('0x85ac4C8E780eae81Dd538053D596E382495f7Db9');

	const recoveryStreamId = isDevNetwork
		? toStreamID('/recovery', nodeManagerAddress)
		: '0xa156eda7dcd689ac725ce9595d4505bf28256454/alpha-recovery';

	const rollcallStreamId = isDevNetwork
		? toStreamID('/rollcall', nodeManagerAddress)
		: '0xa156eda7dcd689ac725ce9595d4505bf28256454/alpha-rollcall';

	const systemStreamId = isDevNetwork
		? toStreamID('/system', nodeManagerAddress)
		: '0xa156eda7dcd689ac725ce9595d4505bf28256454/alpha-system';

	const recoveryStream = await logStoreClient.getStream(recoveryStreamId);
	const rollCallStream = await logStoreClient.getStream(rollcallStreamId);
	const systemStream = await logStoreClient.getStream(systemStreamId);

	const privateKey = (config.client!.auth as PrivateKeyAuthConfig).privateKey;

	const provider = new ethers.providers.JsonRpcProvider(
		config.client!.contracts?.streamRegistryChainRPCs!.rpcs[0]
	);
	const signer = new ethers.Wallet(privateKey, provider);

	const nodeManger = await getNodeManagerContract(signer);

	const plugins: Plugin<any>[] = Object.keys(config.plugins).map((name) => {
		const pluginOptions: PluginOptions = {
			name,
			logStoreClient,
			recoveryStream,
			rollCallStream,
			systemStream,
			observerConfig: config,
			signer,
			nodeManger,
		};
		return createPlugin(name, pluginOptions);
	});

	let started = false;

	const getNode = async (): Promise<NetworkNodeStub> => {
		if (!started) {
			throw new Error('cannot invoke on non-started component');
		}
		return logStoreClient.getNode();
	};

	return {
		getNode,
		start: async () => {
			const nodeId = (await logStoreClient.getNode()).getNodeId();
			ctx.nodeInfo.enterWith({ id: nodeId });

			logger.info(`Starting ${PACKAGE_NAME} version ${PACKAGE_VERSION}`);
			await Promise.all(plugins.map((plugin) => plugin.start()));

			const nodeAddress = await logStoreClient.getAddress();

			logger.info(`Ethereum address ${nodeAddress}`);
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
	logger.error(err.message, {
		type: 'uncaughtException',
	});
	process.exit(1);
});

process.on('unhandledRejection', (err) => {
	logger.error(String(err), {
		type: 'unhandledRejection',
	});
	process.exit(1);
});
