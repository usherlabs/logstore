import type { StreamrClient } from '@logsn/streamr-client';

import { StreamrClientSingleton } from '../StreamrClientSingleton';

// A function designed to accept the StreamrClient Class from within a Web Context.
export async function WebLogStore(base: typeof StreamrClient) {
	StreamrClientSingleton.setClass(base);
	const { LogStoreClient } = await import('../LogStoreClient');

	return LogStoreClient;
}
