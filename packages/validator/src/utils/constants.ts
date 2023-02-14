export const SystemStreamId = 'ryanwould.eth/logstore-system' as const;

export const LogStoreNodeManagerContractAddress = {
	137: '0x', // Polygon Mainnet
	80001: '0x', // Polygon Testnet
} as const; // Polygon Log Store Node Management Address

export const SteamrStreamRegistryContractAddress = {
	137: '0x', // Polygon Mainnet
	80001: '0x', // Polygon Testnet
} as const; // Polygon StreamrStreamRegistry Contract Address -- for managing which streams ar partitioned.
