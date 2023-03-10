import { BigNumber } from 'ethers';

import { generateWallet } from './functions';

export const SAMPLE_WSS_URL = 'wss://node-domain-name:port';
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const NODE_MANAGER = {
	// This is a custom token i deployed and minted tokens to all but the last account
	STAKE_TOKEN: '0xbAf0892F01B8d2F456A80172627A3F6EA0253C80',
	STAKE_REQUIRED_AMOUNT: BigNumber.from(`1${'0'.repeat(18)}`), //1 unit of the STAKE_TOKEN
	WRITE_FEE_POINTS: 10000, // 10000 * 0.01% of write fee
	TREASURY_FEE_POINTS: 2000, // 2000 * 0.01% of write fee
	READ_FEE: 100000000, // 0.0000000001 * 10^18
	INITIAL_NODES: [generateWallet()],
	INITIAL_METADATA: [SAMPLE_WSS_URL],
};

export const NODE_MANAGER_EVENTS = {
	NODE_UPDATED: 'NodeUpdated',
	NODE_REMOVED: 'NodeRemoved',
};

export const CUSTOM_EXCEPTIONS = {
	OWNABLE_NOT_OWNER: 'Ownable: caller is not the owner',
};
