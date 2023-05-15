import { PrivateKeyAuthConfig } from '@concertodao/streamr-client';
import type { ConnectionInfo } from '@ethersproject/web';
import Ajv, { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import cloneDeep from 'lodash/cloneDeep';
// import type { BigNumber } from '@ethersproject/bignumber';
import { MarkOptional } from 'ts-essentials';

import CONFIG_SCHEMA from './config.schema.json';
import { LogStoreClientConfig } from './LogStoreClientConfig';
import { generateClientId } from './utils/utils';

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

export const redactConfig = (config: StrictLogStoreClientConfig): void => {
	if ((config.auth as PrivateKeyAuthConfig)?.privateKey !== undefined) {
		(config.auth as PrivateKeyAuthConfig).privateKey = '(redacted)';
	}
};

export const LogStoreClientConfigInjectionToken = Symbol(
	'LogStoreClientConfig'
);
