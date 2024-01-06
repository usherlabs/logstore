import { LogStoreClientConfig } from '@logsn/client';
import { camelCase, set } from 'lodash';
import * as os from 'os';
import path from 'path';
import { StreamrClientConfig } from 'streamr-client';

export interface Config {
	logStoreClient?: LogStoreClientConfig;
	streamrClient?: StreamrClientConfig;
	httpServer?: {
		port: number;
		sslCertificate?: {
			privateKeyFileName: string;
			certFileName: string;
		};
	};
	plugins?: Record<string, any>;
	pool?: {
		id: string;
		url: string;
		pollInterval: number;
	};
}

// StrictConfig is a config object to which some default values have been applied
// (see `default` definitions in config.schema.json)
export type StrictConfig = Config & {
	logStoreClient: Exclude<Config['logStoreClient'], undefined>;
	streamrClient: Exclude<Config['streamrClient'], undefined>;
	plugins: Exclude<Config['plugins'], undefined>;
	httpServer: Exclude<Config['httpServer'], undefined>;
	pool: Exclude<Config['pool'], undefined>;
};

export interface ConfigFile extends Config {
	$schema?: string;
}

export const getDefaultFile = (): string => {
	const relativePath = '.logstore/config/default.json';
	return path.join(os.homedir(), relativePath);
};

export function overrideConfigToEnvVarsIfGiven(config: Config): void {
	const parseValue = (value: string) => {
		const number = /^-?\d+\.?\d*$/;
		if (number.test(value)) {
			return Number(value);
		} else if (value === 'true') {
			return true;
		} else if (value === 'false') {
			return false;
		} else if (value == 'null') {
			return null;
		} else {
			return value;
		}
	};

	const PREFIX = 'LOGSTORE__BROKER__';
	Object.keys(process.env).forEach((variableName: string) => {
		if (variableName.startsWith(PREFIX)) {
			const parts = variableName
				.substring(PREFIX.length)
				.split('__')
				.map((part: string) => {
					const groups = part.match(/^([A-Z_]*[A-Z])(_\d+)?$/);
					if (groups !== null) {
						const base = camelCase(groups[1]);
						const suffix = groups[2];
						if (suffix === undefined) {
							return base;
						} else {
							const index = Number(suffix.substring(1)) - 1;
							return `${base}[${index}]`;
						}
					} else {
						throw new Error(`Malformed environment variable ${variableName}`);
					}
				});
			const key = parts.join('.');
			const value = parseValue(process.env[variableName]!);
			if (value !== '') {
				set(config, key, value);
			}
		}
	});
}
