export type PoolConfigContract = {
	address: string;
};

export type PoolConfig = {
	sources: string[];
	startBlock: number; // the block on remote network (polygon) when Smart Contract was deployed.
	blockTime: number;
	itemTimeRange: number; // Some range in unix time between each data item
	contracts: {
		reportManager: PoolConfigContract;
		nodeManager: PoolConfigContract;
		storeManager: PoolConfigContract;
		queryManager: PoolConfigContract;
	};
	fees: {
		writeMultiplier: number;
		treasuryMultiplier: number;
		read: number; // Amount in USD cents
	};
};

export type Report = {
	id: string;
	height: number;
	fee: number;
	treasury: number;
	streams: {
		id: string;
		write: { capture: number; bytes: number };
		read: Record<string, { amount: number; bytes: number }>;
	}[];
	nodes: Record<string, number>;
	delegates: Record<string, Record<string, number>>;
};
