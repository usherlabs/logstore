import StreamrClient from '@streamr/sdk';

import { generateEthereumAccount } from '../../src/Ethereum';
import { LogStoreClient } from '../../src/LogStoreClient';

describe('LogStoreClient', () => {
	it('Creates and Destroys gracefully', async () => {
		const wallet = generateEthereumAccount();
		const streamrClient = new StreamrClient({ auth: wallet });
		const logStoreClient = new LogStoreClient(streamrClient, {});

		Promise.allSettled([
			logStoreClient.destroy(),
			await streamrClient.destroy(),
		]);
	});
});
