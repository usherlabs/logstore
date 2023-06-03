import { CONFIG_TEST as STREAMR_CONFIG_TEST } from '@streamr-client';

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
			'0x55B183b2936B57CB7aF86ae0707373fA1AEc7328',
		logStoreStoreManagerChainAddress:
			'0x73A4bB647CdD4b45717A255960B865d6Ad5b8c38',
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
