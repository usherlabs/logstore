import { StreamrClientConfig } from '@streamr/sdk';
import { DeepRequired, MarkOptional } from 'ts-essentials';

export type StrictStreamrClientConfig = MarkOptional<
	Required<StreamrClientConfig>,
	'auth' | 'metrics'
> & {
	contracts: Exclude<Required<StreamrClientConfig['contracts']>, undefined>;
	encryption: Exclude<Required<StreamrClientConfig['encryption']>, undefined>;
	cache: Exclude<Required<StreamrClientConfig['cache']>, undefined>;
	// @ts-expect-error Property '_timeouts' does not exist on type 'StreamrClientConfig'
	_timeouts: Exclude<DeepRequired<StreamrClientConfig['_timeouts']>, undefined>;
};

export const StreamrClientConfigInjectionToken = Symbol('StreamrClientConfig');
