import { toStreamID } from '@streamr/protocol';
import { toEthereumAddress } from '@streamr/utils';
import { defer } from 'rxjs';
import StreamrClient from 'streamr-client';

import { StrictLogStoreClientConfig } from '../Config';

export function systemStreamFromClient(
	client: StreamrClient,
	config: StrictLogStoreClientConfig
) {
	const nodeManagerAddress = toEthereumAddress(
		config.contracts.logStoreNodeManagerChainAddress!
	);

	const systemStreamId = toStreamID('/system', nodeManagerAddress);

	return defer(() => client.getStream(systemStreamId));
}

export const LogStoreClientSystemMessagesInjectionToken = Symbol(
	'LogStoreClientSystemMessagesInjectionToken'
);
