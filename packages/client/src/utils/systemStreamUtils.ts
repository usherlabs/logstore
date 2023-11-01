import { toStreamID } from '@streamr/protocol';
import { toEthereumAddress } from '@streamr/utils';
import { defer } from 'rxjs';

import { LogStoreClient } from '../LogStoreClient';

export function systemStreamFromClient(client: LogStoreClient) {
	const nodeManagerAddress = toEthereumAddress(
		client.getConfig().contracts!.logStoreNodeManagerChainAddress!
	);

	const isDevNetwork =
		nodeManagerAddress ===
		toEthereumAddress('0x85ac4C8E780eae81Dd538053D596E382495f7Db9');

	const systemStreamId = isDevNetwork
		? toStreamID('/system', nodeManagerAddress)
		: '0xa156eda7dcd689ac725ce9595d4505bf28256454/alpha-system';

	return defer(() => client.getStream(systemStreamId));
}


export const LogStoreClientSystemMessagesInjectionToken = Symbol(
	'LogStoreClientSystemMessagesInjectionToken'
);
