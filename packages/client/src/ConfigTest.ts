import { CONFIG_TEST as STREAMR_CONFIG_TEST } from '@logsn/streamr-client';

import { LogStoreClientConfig } from './LogStoreClientConfig';

/**
 * LogStore client constructor options that work in the test environment
 */
export const CONFIG_TEST: LogStoreClientConfig = {
	...STREAMR_CONFIG_TEST,
	logLevel: 'trace',
	contracts: {
		...STREAMR_CONFIG_TEST.contracts,
		logStoreNodeManagerChainAddress:
			'0x85ac4C8E780eae81Dd538053D596E382495f7Db9',
		logStoreStoreManagerChainAddress:
			'0x8560200b8E7477FB09281A0566B50fa6E7a66a34',
		logStoreTheGraphUrl: `http://${
			process.env.STREAMR_DOCKER_DEV_HOST || '127.0.0.1'
		}:8000/subgraphs/name/logstore-dev/network-contracts`,
	},
	network: {
		...STREAMR_CONFIG_TEST.network,
		iceServers: [
			{
				url: 'stun:stun.streamr.network',
				port: 5349,
			},
			{
				url: 'turn:turn.streamr.network',
				port: 5349,
				username: 'BrubeckTurn1',
				password: 'MIlbgtMw4nhpmbgqRrht1Q==',
			},
			{
				url: 'turn:turn.streamr.network',
				port: 5349,
				username: 'BrubeckTurn1',
				password: 'MIlbgtMw4nhpmbgqRrht1Q==',
				tcp: true,
			},
		],
	},
};
