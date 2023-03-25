import { Schema } from 'ajv';

import { LogStoreClient } from './client/LogStoreClient';
import { StrictConfig } from './config/config';
import { validateConfig } from './config/validateConfig';

export interface PluginOptions {
	name: string;
	logStoreClient: LogStoreClient;
	brokerConfig: StrictConfig;
}

export abstract class Plugin<T> {
	readonly name: string;
	readonly logStoreClient: LogStoreClient;
	readonly brokerConfig: StrictConfig;
	readonly pluginConfig: T;

	constructor(options: PluginOptions) {
		this.name = options.name;
		this.logStoreClient = options.logStoreClient;
		this.brokerConfig = options.brokerConfig;
		this.pluginConfig = options.brokerConfig.plugins[this.name];
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
