/**
 * Utility Types
 */
import { F } from 'ts-toolbelt';

import { LogStoreClient } from './LogStoreClient';

export type MaybeAsync<T extends F.Function> = T | F.Promisify<T>; // Utility Type: make a function maybe async

declare global {
	interface Window {
		LogStoreClient: LogStoreClient;
	}
}
