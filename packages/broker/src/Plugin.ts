import { LogStoreClient } from '@concertodao/logstore-client';
import { Schema } from 'ajv';

import { ApiAuthentication } from './apiAuthentication';
import { StrictConfig } from './config/config';
import { validateConfig } from './config/validateConfig';
import { Endpoint } from './httpServer';

export interface PluginOptions {
	name: string;
	logStoreClient: LogStoreClient;
	brokerConfig: StrictConfig;
}

export type HttpServerEndpoint = Omit<Endpoint, 'apiAuthentication'>;

export abstract class Plugin<T extends object> {
	readonly name: string;
	readonly logStoreClient: LogStoreClient;
	readonly brokerConfig: StrictConfig;
	readonly pluginConfig: T;
	private readonly httpServerEndpoints: HttpServerEndpoint[] = [];

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

	getApiAuthentication(): ApiAuthentication | undefined {
		if ('apiAuthentication' in this.pluginConfig) {
			return (
				(this.pluginConfig.apiAuthentication as ApiAuthentication | null) ??
				undefined
			);
		} else {
			return this.brokerConfig.apiAuthentication;
		}
	}

	addHttpServerEndpoint(endpoint: HttpServerEndpoint): void {
		this.httpServerEndpoints.push(endpoint);
	}

	getHttpServerEndpoints(): HttpServerEndpoint[] {
		return this.httpServerEndpoints;
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
