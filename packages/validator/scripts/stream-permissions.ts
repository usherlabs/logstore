import LogStoreClient, { CONFIG_TEST } from '@logsn/client';
import 'dotenv/config';

const BROKER_NODE_PRIVATE_KEY =
	'0xb1abdb742d3924a45b0a54f780f0f21b9d9283b231a0a0b35ce5e455fa5375e7' as const;
const systemStreamId =
	'0x85ac4C8E780eae81Dd538053D596E382495f7Db9/system' as const;
// Should be deployed here http://localhost/core/streams/0x85ac4C8E780eae81Dd538053D596E382495f7Db9%2Fsystem

const client = new LogStoreClient({
	...CONFIG_TEST,
	logLevel: 'trace',
	auth: {
		privateKey: BROKER_NODE_PRIVATE_KEY,
	},
});

(async () => {
	const stream = await client.getStream(systemStreamId);
	const p = await stream.getPermissions();
	console.log('STREAM:', stream.id);
	console.log('PERMISSIONS:', p);
})();
