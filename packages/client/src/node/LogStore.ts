import { StreamrClient } from '@logsn/streamr-client';

import { StreamrClientSingleton } from '../StreamrClientSingleton';

// A function designed to accept the StreamrClient Class from within a Web Context.
export async function LogStore() {
	StreamrClientSingleton.setClass(StreamrClient);
	const { LogStoreClient } = await import('../LogStoreClient');

	return LogStoreClient;
}
