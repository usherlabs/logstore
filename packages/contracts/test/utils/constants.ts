import { BigNumber } from 'ethers';

export const SAMPLE_WSS_URL = 'wss://node-domain-name:port';
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const CONSUMER_ADDRESS = '0x801B769Cd87685d4Bf49acDe776d6b0C59F5E779'; //address of the 19th account of ethers.getSigners();
export const CONSUMER_INDEX = 18;
export const FAKE_STREAMR_REGISTRY =
	'0x809b4f3cceae82dc8e640ffed743258c3b817480';
export const SAMPLE_STREAM_ID = 'xand6r.eth/demos/twitter/sample';

export const NODE_MANAGER = {
	// This is a custom token i deployed and minted tokens to all but the last account
	STAKE_TOKEN: '0x35a6a5401bf557fcec3f2ab871bc8c78b47ef54e',
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
	STAKE_DELEGATE_UPDATED: 'StakeDelegateUpdated',
	REQUIRES_WHITELIST_CHANGED: 'RequiresWhitelistChanged',
	REPORT_PROCESSED: 'ReportProcessed',
	TRANSFER: 'Transfer',
};

export const REPORT_MANAGER_EVENTS = {
	REPORT_ACCEPTED: 'ReportAccepted',
	REPORT_PROCESSED: 'ReportProcessed',
};

export const QUERY_MANAGER_EVENTS = {
	DATA_QUERIED: 'DataQueried',
	STAKE: 'Stake',
};

export const STORE_MANAGER_EVENTS = {
	STORE_UPDATED: 'StoreUpdated',
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
	INVALID_REPORT: 'error_invalidReport',
	INVALID_REPORTER: 'error_invalidReporter',
	STAKE_REQUIRED: 'error_stakeRequired',
	QUORUM_NOT_MET: 'error_quorumNotMet',
};

export const REPORT_TIME_BUFFER = 100; // 100 milliseconds
// // 60 * 1000; // milliseconds;
