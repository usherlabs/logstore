import type { MessageMetadata } from 'streamr-client';

export type PoolConfigContract = {
	address: string;
};

export type PoolConfigContracts = {
	reportManager: PoolConfigContract;
	nodeManager: PoolConfigContract;
	storeManager: PoolConfigContract;
	queryManager: PoolConfigContract;
};

export type PoolConfig = {
	sources: string[];
	startBlock: number; // the block on remote network (polygon) when Smart Contract was deployed.
	blockTime: number;
	itemTimeRange: number; // Some range in unix time between each data item
	contracts: PoolConfigContracts;
	fees: {
		writeMultiplier: number;
		treasuryMultiplier: number;
		read: number; // Amount in USD cents
	};
};

export type ReportEvent = {
	id: string;
	hash: string;
	size: number;
};

export type Report = {
	id: string;
	height: number;
	treasury: number;
	streams: {
		id: string;
		capture: number;
		bytes: number;
	}[];
	consumers: {
		id: string;
		capture: number;
		bytes: number;
	}[];
	nodes: Record<string, number>;
	delegates: Record<string, Record<string, number>>;

	// The following properties are not signed by the Broker Nodes
	events: {
		queries: (ReportEvent & {
			query: string;
			nonce: string;
			consumer: string;
		})[];
		storage: ReportEvent[];
	};
};

export type BrokerNode = {
	id: string;
	index: number;
	metadata: string;
	lastSeen: number;
	next: string;
	prev: string;
	stake: number;
	delegates: string[];
};

export type StreamrMessage = { content: any; metadata: MessageMetadata };
