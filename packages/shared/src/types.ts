import { QueryOptions } from '@logsn/protocol';
import { BigNumber } from 'ethers';

export enum Manager {
	NodeManager = 'NodeManager',
	StoreManager = 'StoreManager',
	QueryManager = 'QueryManager',
	ReportManager = 'ReportManager',
	TokenManager = 'TokenManager',
}

export enum Network {
	Local = 5,
	Dev = 8997,
	Testnet = 80001,
	Mainnet = 137,
}

export type ReportEvent = {
	id: string;
	hash: string;
	size: number;
};

export interface IReport {
	id: string;
	height: number;
	treasury: BigNumber;
	streams: {
		id: string;
		capture: BigNumber;
		bytes: number;
	}[];
	consumers: {
		id: string;
		capture: BigNumber;
		bytes: number;
	}[];
	nodes: Record<string, BigNumber>;
	delegates: Record<string, Record<string, BigNumber>>;

	// The following properties are not signed by the Broker Nodes
	events?: {
		queries: (ReportEvent & {
			query: QueryOptions;
			consumer: string;
		})[];
		storage: ReportEvent[];
	};
}
