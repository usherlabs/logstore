import type { ConnectionInfo } from '@ethersproject/web';
import Ajv, { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import cloneDeep from 'lodash/cloneDeep';
// import type { BigNumber } from '@ethersproject/bignumber';
import { ExternalProvider } from 'streamr-client';
import { MarkOptional } from 'ts-essentials';

import CONFIG_SCHEMA from './config.schema.json';
import { LogStoreClientConfig } from './LogStoreClientConfig';
import { generateClientId } from './utils/utils';

export interface ProviderAuthConfig {
	ethereum: ExternalProvider;
}

export interface PrivateKeyAuthConfig {
	privateKey: string;
	// The address property is not used. It is included to make the object
	// compatible with StreamrClient.generateEthereumAccount(), as we typically
	// use that method to generate the client "auth" option.
	address?: string;
}

export interface TrackerRegistryContract {
	jsonRpcProvider?: ConnectionInfo;
	contractAddress: string;
}

export type StrictLogStoreClientConfig = MarkOptional<
	Required<LogStoreClientConfig>,
	'auth' | 'metrics'
> & {
	network: MarkOptional<
		Exclude<Required<LogStoreClientConfig['network']>, undefined>,
		'location'
	>;
	contracts: Exclude<Required<LogStoreClientConfig['contracts']>, undefined>;
	encryption: Exclude<Required<LogStoreClientConfig['encryption']>, undefined>;
	cache: Exclude<Required<LogStoreClientConfig['cache']>, undefined>;
	// _timeouts: Exclude<DeepRequired<LogStoreClientConfig['_timeouts']>, undefined>;
};

export const createStrictConfig = (
	input: LogStoreClientConfig = {}
): StrictLogStoreClientConfig => {
	// TODO is it good to cloneDeep the input object as it may have object references (e.g. auth.ethereum)?
	const config: StrictLogStoreClientConfig = validateConfig(cloneDeep(input));
	config.id ??= generateClientId();
	return config;
};

export const validateConfig = (
	data: unknown
): StrictLogStoreClientConfig | never => {
	const ajv = new Ajv({
		useDefaults: true,
	});
	addFormats(ajv);
	ajv.addFormat('ethereum-address', /^0x[a-zA-Z0-9]{40}$/);
	ajv.addFormat('ethereum-private-key', /^(0x)?[a-zA-Z0-9]{64}$/);
	const validate = ajv.compile<StrictLogStoreClientConfig>(CONFIG_SCHEMA);
	if (!validate(data)) {
		throw new Error(
			validate
				.errors!.map((e: ErrorObject) => {
					let text = ajv.errorsText([e], { dataVar: '' }).trim();
					if (e.params.additionalProperty) {
						text += `: ${e.params.additionalProperty}`;
					}
					return text;
				})
				.join('\n')
		);
	}
	return data;
};

// TODO: Research what is the purpose of the redactConfig function
export const redactConfig = (config: StrictLogStoreClientConfig): void => {
	if ((config.auth as PrivateKeyAuthConfig)?.privateKey !== undefined) {
		(config.auth as PrivateKeyAuthConfig).privateKey = '(redacted)';
	}
};

export const LogStoreClientConfigInjectionToken = Symbol(
	'LogStoreClientConfig'
);