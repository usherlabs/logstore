import Ajv, { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import cloneDeep from 'lodash/cloneDeep';
// import type { BigNumber } from '@ethersproject/bignumber';
import 'reflect-metadata';
import { ExternalProvider, StreamrClientConfig } from 'streamr-client';
import { MarkOptional } from 'ts-essentials';

import CONFIG_SCHEMA from './config.schema.json';
import { generateClientId } from './utils/utils';

// import CONFIG_SCHEMA from './config.schema.json';

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

export type StrictStreamrClientConfig = MarkOptional<
	Required<StreamrClientConfig>,
	'auth' | 'metrics'
> & {
	network: MarkOptional<
		Exclude<Required<StreamrClientConfig['network']>, undefined>,
		'location'
	>;
	contracts: Exclude<Required<StreamrClientConfig['contracts']>, undefined>;
	encryption: Exclude<Required<StreamrClientConfig['encryption']>, undefined>;
	cache: Exclude<Required<StreamrClientConfig['cache']>, undefined>;
	// _timeouts: Exclude<DeepRequired<StreamrClientConfig['_timeouts']>, undefined>;
};

export const createStrictConfig = (
	input: StreamrClientConfig = {}
): StrictStreamrClientConfig => {
	// TODO is it good to cloneDeep the input object as it may have object references (e.g. auth.ethereum)?
	const config: StrictStreamrClientConfig = validateConfig(cloneDeep(input));
	config.id ??= generateClientId();
	return config;
};

export const validateConfig = (
	data: unknown
): StrictStreamrClientConfig | never => {
	const ajv = new Ajv({
		useDefaults: true,
	});
	addFormats(ajv);
	ajv.addFormat('ethereum-address', /^0x[a-zA-Z0-9]{40}$/);
	ajv.addFormat('ethereum-private-key', /^(0x)?[a-zA-Z0-9]{64}$/);
	const validate = ajv.compile<StrictStreamrClientConfig>(CONFIG_SCHEMA);
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

export const ClientConfigInjectionToken = Symbol('LogStoreClientConfig');
