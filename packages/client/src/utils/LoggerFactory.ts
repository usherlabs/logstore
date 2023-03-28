import { Logger } from '@streamr/utils';
import { inject, Lifecycle, scoped } from 'tsyringe';

import {
	LogStoreClientConfigInjectionToken,
	StrictLogStoreClientConfig,
} from '../Config';

@scoped(Lifecycle.ContainerScoped)
export class LoggerFactory {
	private readonly config: Pick<StrictLogStoreClientConfig, 'id' | 'logLevel'>;

	constructor(
		@inject(LogStoreClientConfigInjectionToken)
		config: Pick<StrictLogStoreClientConfig, 'id' | 'logLevel'>
	) {
		this.config = config;
	}

	createLogger(module: NodeJS.Module): Logger {
		return new Logger(module, this.config.id, this.config.logLevel);
	}
}
