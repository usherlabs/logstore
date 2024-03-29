import { Logger } from '@streamr/utils';
import fetch, { Response } from 'node-fetch';
import { inject, Lifecycle, scoped } from 'tsyringe';

import {
	StreamrClientConfigInjectionToken,
	StrictStreamrClientConfig,
} from '../Config';
import { LoggerFactory, LoggerFactoryInjectionToken } from '../LoggerFactory';

@scoped(Lifecycle.ContainerScoped)
export class HttpFetcher {
	private config: Pick<StrictStreamrClientConfig, '_timeouts'>;
	private readonly logger: Logger;

	constructor(
		@inject(LoggerFactoryInjectionToken) loggerFactory: LoggerFactory,
		@inject(StreamrClientConfigInjectionToken)
		config: Pick<StrictStreamrClientConfig, '_timeouts'>
	) {
		this.config = config;
		this.logger = loggerFactory.createLogger(module);
	}

	fetch(url: string, init?: Record<string, unknown>): Promise<Response> {
		// eslint-disable-next-line no-underscore-dangle
		const timeout = this.config._timeouts.httpFetchTimeout;
		this.logger.debug('fetching', { url, timeout });
		return fetch(url, {
			timeout,
			...init,
		} as any);
	}
}
