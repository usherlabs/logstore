import { EthereumAddress } from '@streamr/utils';
import { AsyncLocalStorage } from 'async_hooks';



import { PropagationResolver } from './PropagationResolver';
import { QueryRequestManager } from './QueryRequestManager';

export type LogStoreContext = {
	clientId: EthereumAddress;
	queryRequestManager: QueryRequestManager;
	propagationResolver: PropagationResolver;
};
/**
 * An object representing the context of a log store instance.
 *
 * The intention here is to provide a way to access important objects from the
 * log store instance without having to pass them around everywhere.
 *
 * It should be used on some starting point of the log store, like the
 * `LogStorePlugin` constructor or start command, and every function that needs
 * access to the log store context, if executed after the starting point, will
 * have access to it.
 *
 * It does not share context between different log store instances.
 */
export const logStoreContext = new AsyncLocalStorage<LogStoreContext>();
