import { BigNumber } from 'ethers';

export const SAMPLE_WSS_URL = 'wss://node-domain-name:port';
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const NODE_MANAGER = {
	// This is a custom token i deployed and minted tokens to all but the last account
	STAKE_TOKEN: '0xbAf0892F01B8d2F456A80172627A3F6EA0253C80',
	STAKE_REQUIRED_AMOUNT: BigNumber.from(`1${'0'.repeat(1)}`), //1 unit of the STAKE_TOKEN
	WRITE_FEE_POINTS: 10000, // 10000 * 0.01% of write fee
	TREASURY_FEE_POINTS: 2000, // 2000 * 0.01% of write fee
	READ_FEE: 100000000, // 0.0000000001 * 10^18
	INITIAL_NODES: ['0x15C5a74e6091e304c997c53D225eBc759ADda768'], //random wallet address
	INITIAL_METADATA: [SAMPLE_WSS_URL],
};

export const NODE_MANAGER_EVENTS = {
	NODE_UPDATED: 'NodeUpdated',
	NODE_REMOVED: 'NodeRemoved',
	NOTE_WHITELIST_APPROVED: 'NodeWhitelistApproved',
	NOTE_WHITELIST_REJECTED: 'NodeWhitelistRejected',
	NODE_STAKE_UPDATED: 'NodeStakeUpdated',
	REQUIRES_WHITELIST_CHANGED: 'RequiresWhitelistChanged',
	REPORT_PROCESSED: 'ReportProcessed',
	TRANSFER: 'Transfer',
};

export const NODE_WHITELIST_STATE = {
	NONE: 0,
	APPROVED: 1,
	REJECTED: 2,
};

export const CUSTOM_EXCEPTIONS = {
	OWNABLE_NOT_OWNER: 'Ownable: caller is not the owner',
	NODE_NOT_WHITELISTED: 'error_notApproved',
	STAKE_INSUFFICIENT_BALANCE: 'error_insufficientStake',
	INVALID_WITHDRAW_AMOUNT: 'error_notEnoughStake',
	INSUFFICIENT_DELEGATE_AMOUNT: 'error_insufficientDelegateAmount',
	NONE_EXISTENT_NODE: 'error_invalidNode',
};
