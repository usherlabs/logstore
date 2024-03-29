import { LogStoreClientConfig } from './LogStoreClientConfig';

/**
 * LogStore client constructor options that work in the test environment
 */
export const CONFIG_TEST: LogStoreClientConfig = {
	contracts: {
		logStoreNodeManagerChainAddress:
			'0x85ac4C8E780eae81Dd538053D596E382495f7Db9',
		logStoreStoreManagerChainAddress:
			'0x8560200b8E7477FB09281A0566B50fa6E7a66a34',
		logStoreTokenManagerChainAddress:
			'0x62c82404c1937E27C92E24901979A4d9b1b9858e',
		logStoreQueryManagerChainAddress:
			'0x65d379f29BE436bD367699f3Dd7A436c54795a49',

		logStoreTheGraphUrl: `http://${
			process.env.STREAMR_DOCKER_DEV_HOST || '127.0.0.1'
		}:8000/subgraphs/name/logstore-dev/network-contracts`,
	},
	// network: {
	// 	...STREAMR_CONFIG_TEST.network,
	// 	iceServers: [
	// 		{
	// 			url: 'stun:stun.streamr.network',
	// 			port: 5349,
	// 		},
	// 		{
	// 			url: 'turn:turn.streamr.network',
	// 			port: 5349,
	// 			username: 'BrubeckTurn1',
	// 			password: 'MIlbgtMw4nhpmbgqRrht1Q==',
	// 		},
	// 		{
	// 			url: 'turn:turn.streamr.network',
	// 			port: 5349,
	// 			username: 'BrubeckTurn1',
	// 			password: 'MIlbgtMw4nhpmbgqRrht1Q==',
	// 			tcp: true,
	// 		},
	// 	],
	// },
};
