export const SystemStreamId = 'ryanwould.eth/logstore-system' as const;

// Determined like so: https://ethereum.stackexchange.com/questions/82365/how-get-network-id-with-ethers-js
export const LogStoreNetworkConfig = {
	137: {
		NodeManager: '0x',
		StoreManager: '0x',
		QueryManager: '0x',
	},
} as const;
