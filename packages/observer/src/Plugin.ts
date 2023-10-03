import { validateConfig } from '@logsn/broker/dist/src/config/validateConfig';
import { LogStoreClient, Stream } from '@logsn/client';
import { LogStoreNodeManager } from '@logsn/contracts';
import { Schema } from 'ajv';
import { Signer } from 'ethers';

import { StrictConfig } from './config/config';

export interface PluginOptions {
	name: string;
	logStoreClient: LogStoreClient;
	recoveryStream: Stream;
	rollCallStream: Stream;
	systemStream: Stream;
	observerConfig: StrictConfig;
	signer: Signer;
	nodeManger: LogStoreNodeManager;
}

export abstract class Plugin<T extends object> {
	readonly name: string;
	readonly logStoreClient: LogStoreClient;
	readonly recoveryStream: Stream;
	readonly rollCallStream: Stream;
	readonly systemStream: Stream;
	readonly observerConfig: StrictConfig;
	readonly signer: Signer;
	readonly nodeManger: LogStoreNodeManager;
	readonly pluginConfig: T;

	constructor(options: PluginOptions) {
		this.name = options.name;
		this.logStoreClient = options.logStoreClient;
		this.recoveryStream = options.recoveryStream;
		this.rollCallStream = options.rollCallStream;
		this.systemStream = options.systemStream;
		this.observerConfig = options.observerConfig;
		this.signer = options.signer;
		this.nodeManger = options.nodeManger;
		this.pluginConfig = options.observerConfig.plugins[this.name];
		const configSchema = this.getConfigSchema();
		if (configSchema !== undefined) {
			validateConfig(this.pluginConfig, configSchema, `${this.name} plugin`);
		}
	}

	/**
	 * This lifecycle method is called once when Broker starts
	 */
	abstract start(): Promise<unknown>;

	/**
	 * This lifecycle method is called once when Broker stops
	 * It is be called only if the plugin was started successfully
	 */
	abstract stop(): Promise<unknown>;

	// eslint-disable-next-line class-methods-use-this
	getConfigSchema(): Schema | undefined {
		return undefined;
	}
}
