import { providers, Wallet } from 'ethers';

import { CONFIG_TEST } from '../src/ConfigTest';
import { LogStoreClient } from '../src/LogStoreClient';

// import { createTestStream } from '../test-utils/utils';

const privKey =
	'0x2cd9855d17e01ce041953829398af7e48b24ece04ff9d0e183414de54dc52285';
const streamId = '0x505D48552Ac17FfD0845FFA3783C2799fd4aaD78/example';

const fromTimestamp = 10000;

// ? logstore-cli query stake -u -w 0x2cd9855d17e01ce041953829398af7e48b24ece04ff9d0e183414de54dc52285 -h http://localhost:8546 10

(async () => {
	const provider = new providers.JsonRpcProvider(
		CONFIG_TEST.contracts?.streamRegistryChainRPCs?.rpcs[0].url,
		CONFIG_TEST.contracts?.streamRegistryChainRPCs?.chainId
	);
	const publisherAccount = new Wallet(privKey, provider);
	const client: LogStoreClient = new LogStoreClient({
		...CONFIG_TEST,
		auth: {
			privateKey: publisherAccount.privateKey,
		},
	});

	await client.query(
		streamId,
		{ from: { timestamp: fromTimestamp } },
		(msg: any) => {
			console.log(msg);
		}
	);
})();
