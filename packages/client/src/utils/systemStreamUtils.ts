import { toStreamID } from '@streamr/protocol';
import { toEthereumAddress } from '@streamr/utils';
import { defer } from 'rxjs';

import { LogStoreClient } from '../LogStoreClient';

export function systemStreamFromClient(client: LogStoreClient) {
	const nodeManagerAddress = toEthereumAddress(
		client.getConfig().contracts!.logStoreNodeManagerChainAddress!
	);

	const systemStreamId = toStreamID('/system', nodeManagerAddress);

	return defer(() => client.getStream(systemStreamId));
}

export const LogStoreClientSystemMessagesInjectionToken = Symbol(
	'LogStoreClientSystemMessagesInjectionToken'
);
