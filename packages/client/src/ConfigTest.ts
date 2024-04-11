import { LogStoreClientConfig } from './LogStoreClientConfig';

/**
 * LogStore client constructor options that work in the test environment
 */
export const CONFIG_TEST: LogStoreClientConfig = {
	contracts: {
		logStoreNodeManagerChainAddress:
			'0xB1a242e5eA2AaCC16E8DA85847adeCBa473e318F',
		logStoreStoreManagerChainAddress:
			'0x29DAE06145698A4Af8D54B91D0c6391C4B28102E',
		logStoreTokenManagerChainAddress:
			'0x813cb73aaEcBE7df1879B454fDa23Ef3d979D22a',
		logStoreQueryManagerChainAddress:
			'0xCcdb958F7160ad3cEd9438596536fc214BBd1822',

		logStoreTheGraphUrl: `http://${
			process.env.STREAMR_DOCKER_DEV_HOST || '127.0.0.1'
		}:8800/subgraphs/name/logstore-dev/network-contracts`,
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
