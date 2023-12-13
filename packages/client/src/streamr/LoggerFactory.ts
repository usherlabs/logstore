import { Logger } from '@streamr/utils';

export interface LoggerFactory {
	createLogger(module: NodeJS.Module): Logger;
}

export const LoggerFactoryInjectionToken = Symbol('LoggerFactory');
