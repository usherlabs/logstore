import { POLYGON } from '../env-config';

export const SystemStreamId = 'ryanwould.eth/logstore-system' as const;

export const LogStoreNetworkConfig = {
	137: {
		NodeManager: '0x',
		StoreManager: '0x',
		QueryManager: '0x',
	},
} as const;

export const DefaultNetworkEndpoints = {
	137: POLYGON || 'wss://polygon-bor.publicnode.com',
	// 80001: POLYGON || 'wss://rpc.ankr.com/polygon_mumbai',
} as const;
