/**
 * @description This file contains dummy data used as placeholders during development
 */

import testEthABI from './testABI.json';

//TODO: hardcode a pool configuration for now, eventually move this to pool settings
export const POOL_CONFIG_DATA = {
	github: 'https://github.com/usherlabs/etl',
	sources: {
		streamr: {
			startTimestamp: 1663590496073, // random date
			interval: 3600000, //corresponds to an hour
		},
		polygon: {
			startBlock: 33302066,
			interval: 1800, //average number of blocks per hour
			rpc: 'https://polygon-rpc.com',
		},
		ethereum: {
			startBlock: 33302066,
			interval: 1800, //average number of blocks per hour
			rpc: 'https://polygon-rpc.com',
		},
	},
};

export const DUMMY_PIPELINE_DATA = [
	{
		id: "random32bytes",
		sources: [
			[
				'ethereum',
				'0xc5e9ddebb09cd64dfacab4011a0d5cedaf7c9bdb',
				'abilink.json',
				'VouchAdded',
			],
			// ["polygon", "0x_my_NFT_contract","abilink.json", "nft_transfer"],
			['streamr', 'streamr.eth/demos/helsinki-trams'],
		],
		contract: 'arweave_tx_id_of_contract',
	},
];

export const DUMMY_ETH_ABI = testEthABI;
